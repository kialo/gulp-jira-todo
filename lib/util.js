var util = require('gulp-util');

module.exports = {
    throwPluginError: function pluginError (message) {
        throw new util.PluginError('gulp-jira-todo', message);
    }
};
