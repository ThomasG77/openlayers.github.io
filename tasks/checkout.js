var cp = require('child_process');
var fs = require('fs');

var Q = require('q');

// util function for handling spawned processes as promises
function spawn(exe, args, cwd) {
  var deferred = Q.defer();
  var child = cp.spawn(exe, args, {cwd: cwd || process.cwd()});
  var buffer = [];
  child.stderr.on('data', function(chunk) {
    buffer.push(chunk.toString());
  });
  child.stdout.on('data', function(chunk) {
    deferred.notify(chunk.toString());
  });
  child.on('exit', function(code) {
    if (code) {
      var msg = buffer.join('') || 'Process failed: ' + code;
      deferred.reject(new Error(msg));
    } else {
      deferred.resolve();
    }
  });
  return deferred.promise;
}

// create a broken promise
function fail(reason) {
  var deferred = Q.defer();
  deferred.reject(new Error(reason));
  return deferred.promise;
}

// create a fulfilled promise
function pass() {
  var deferred = Q.defer();
  deferred.resolve();
  return deferred.promise;
}

// clone a repo into the given dir if it doesn't already exist
function clone(git, repo, dir) {
  if (fs.existsSync(dir)) {
    return pass();
  }
  return spawn(git, ['clone', repo, dir]);
}

// check out a branch
function checkout(git, branch, dir) {
  return spawn(git, ['checkout', branch, '-f'], dir);
}

// fetch from a remote
function fetch(git, remote, dir) {
  return spawn(git, ['fetch', remote], dir);
}

// reset to match remote/branch
function reset(git, remote, branch, dir) {
  return spawn(git, ['reset', '--hard', remote + '/' + branch], dir);
}

// clean up unversioned files
function clean(git, dir) {
  return spawn(git, ['clean', '-f', '-d'], dir);
}


/** @param {Object} grunt Grunt. */
module.exports = function(grunt) {
  grunt.registerTask('checkout', 'Check out with git.', function(branch) {
    var done = this.async();

    var options = this.options({
      git: 'git',
      branch: 'master'
    });
    branch = branch || options.branch;

    if (!options.repo) {
      return done(new Error('Missing "repo" property in checkout options.'));
    }
    if (!options.dir) {
      return done(new Error('Missing "dir" property in checkout options.'));
    }

    var remote = 'origin';
    grunt.log.writeln('Cloning ' + options.repo + ' into ' + options.dir);
    clone(options.git, options.repo, options.dir).
        then(function() {
          grunt.log.writeln('Checking out ' + branch);
          return checkout(options.git, branch, options.dir);
        }).
        then(function() {
          grunt.log.writeln('Cleaning ' + branch);
          return clean(options.git, options.dir);
        }).
        then(function() {
          grunt.log.writeln('Fetching from ' + remote);
          return fetch(options.git, remote, options.dir);
        }).
        then(function() {
          grunt.log.writeln('Resetting to ' + remote + '/' + branch);
          return reset(options.git, remote, branch, options.dir);
        }).
        then(function() {
          done();
        }, function(error) {
          done(error);
        }, function(progress) {
          grunt.verbose.writeln(progress);
        });

  });
};
