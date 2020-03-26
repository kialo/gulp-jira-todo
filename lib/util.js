var PluginError = require('plugin-error');

function newPluginError (message) {
    return new PluginError('gulp-jira-todo', message);
}

module.exports = {
    throwPluginError: function pluginError (message) {
        throw newPluginError(message);
    },
    newPluginError: newPluginError,
};
