/*
 * grunt-jira-todo
 * https://github.com/pigulla/grunt-jira-todo
 *
 * Copyright (c) 2014-2015 Raphael Pigulla
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function (grunt) {
    // Project configuration.
    grunt.initConfig({
        jshint: {
            all: [
                'Gruntfile.js',
                'index.js',
                'lib/**/*.js',
                'test/**/*.js'
            ],
            options: {
                jshintrc: true
            }
        },

        buster: {
            tests: {
                test: {
                    config: 'test/buster.js'
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-buster');

    grunt.registerTask('test', ['buster:tests']);
    grunt.registerTask('default', ['jshint', 'test']);
};
