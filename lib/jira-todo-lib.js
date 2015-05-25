'use strict';

var _ = require('lodash'),
    async = require('async'),
    request = require('request'),
    xregexp = require('xregexp').XRegExp,
    util = require('./util');

var ISSUE_REGEX = '(?<key>(?<project>[A-Z][_A-Z0-9]*)-(?<number>\\d+))';

/**
 * @constructor
 * @class JiraTodo
 * @param {Object} options
 */
function JiraTodo(options) {
    _.defaults(options, {
        issueRegex: ISSUE_REGEX
    });

    this.opts = options;
    this.issueRegex = xregexp(options.issueRegex, 'gi');
}

/**
 * Processes the list of files, extracts the todos, retrieves their status and returns any problems that were found.
 * Please note that the callback is not a Node-style callback since it will never fail. Any errors that are encountered
 * are handled through gulp PluginErrors calls.
 *
 * @param {Array.<string>} todos
 * @param {function(Array.<Object>)} callback
 */
JiraTodo.prototype.processTODOs = function (todos, callback) {
    var self = this,
        allIssues = [],
        problems = [];

    todos.forEach(function (todo) {
        var issuesFound = this.getIssuesForTodo(todo);

        issuesFound.withoutTicket.forEach(function (issue) {
            problems.push({ kind: 'withoutTicket', issue: issue });
        });

        [].push.apply(allIssues, issuesFound.issues);
    }, this);

    this.getJiraStatusForIssues(_.pluck(allIssues, 'key'), function (err, statuses) {
        allIssues.forEach(function (issue) {
            var status = statuses[issue.key];
            if (status !== null && self.opts.allowedIssueTypes.indexOf(status.type) === -1) {
                problems.push({ kind: 'typeForbidden', issue: issue, status: status });
            } else if (status !== null && self.opts.allowedStatuses.indexOf(status.id) === -1) {
                problems.push({ kind: 'statusForbidden', issue: issue, status: status });
            }
        });

        callback(problems);
    });
};

/**
 * Returns all issues referenced in the given todoItem.
 *
 * @param {Object} todoItem
 * @return {Object}
 */
JiraTodo.prototype.getIssuesForTodo = function (todoItem) {
    var issues = this.parseTodoItem(todoItem),
        todosWithoutIssue = issues.filter(function (issue) {
            return !issue.hasOwnProperty('key');
        }, this),
        relevantIssues = issues.filter(function (issue) {
            return issue.hasOwnProperty('key') && this.opts.projects.indexOf(issue.project) !== -1;
        }, this);

    return {
        issues: relevantIssues,
        withoutTicket: todosWithoutIssue
    };
};

/**
 * Parses the given todoItem and returns all todos matching the configured regular expression.
 *
 * @param {Object} todoItem
 * @return {Array.<Object>}
 */
JiraTodo.prototype.parseTodoItem = function (todoItem) {
    var referencedIssues = [];

    xregexp.forEach(todoItem.text, this.issueRegex, function (issueMatches) {
        referencedIssues.push({
            key: issueMatches.key,
            project: issueMatches.project,
            number: parseInt(issueMatches.number, 10),
            file: todoItem.file,
            line: todoItem.line
        });
    });

    return referencedIssues.length ? referencedIssues : [{
        file: todoItem.file,
        line: todoItem.line
    }];
};

/**
 * Returns the statuses for the given Jira issues.
 *
 * @param {Array.<string>} issueKeys
 * @param {function} callback
 */
JiraTodo.prototype.getJiraStatusForIssues = function (issueKeys, callback) {
    var result = {},
        self = this;

    async.eachLimit(_.uniq(issueKeys), 3, function (issueKey, cb) {
        var url = self.opts.jira.url + '/rest/api/2/issue/' + issueKey;

        console.log('Sending request to ' + url);
        result[issueKey] = null;

        request({
            url: url,
            method: 'GET',
            auth: {
                username: self.opts.jira.username,
                password: self.opts.jira.password
            }
        }, function (err, response, body) {
            var data;

            if (err) {
                util.throwPluginError('Error retrieving status for issue "' + issueKey + '": "' + err.toString() + '".');
                return cb();
            }

            if (response.statusCode >= 400) {
                util.throwPluginError('Request to Jira for issue "' + issueKey +
                    '" failed with status code ' + response.statusCode + '.');
                return cb();
            }

            try {
                data = JSON.parse(body);
            } catch (e) {
                util.throwPluginError('Error parsing JSON response for issue "' + issueKey + '": "' + e.message + '".');
                return cb();
            }

            if (data.errorMessages) {
                util.throwPluginError('Error getting status for issue "' + issueKey + '": "' + data.errorMessages[0] + '".');
                return cb();
            }

            result[issueKey] = {
                id: parseInt(data.fields.status.id, 10),
                statusName: data.fields.status.name,
                type: parseInt(data.fields.issuetype.id, 10),
                typeName: data.fields.issuetype.name
            };
            cb();
        });
    }, function () {
        callback(null, result);
    });
};

module.exports = JiraTodo;
