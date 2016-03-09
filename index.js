'use strict';
var path = require('path');
var gutil = require('gulp-util');
var through = require('through2');
var objectAssign = require('object-assign');
var file = require('vinyl-file');
var revHash = require('rev-hash');
var revPath = require('rev-path');
var sortKeys = require('sort-keys');
var modifyFilename = require('modify-filename');

function relPath(base, filePath) {
  if (filePath.indexOf(base) !== 0) {
    return filePath.replace(/\\/g, '/');
  }

  var newPath = filePath.substr(base.length).replace(/\\/g, '/');

  if (newPath[0] === '/') {
    return newPath.substr(1);
  }

  return newPath;
}

function getManifestFile(opts, cb) {
  file.read(opts.path, opts, function (err, manifest) {
    if (err) {
      // not found
      if (err.code === 'ENOENT') {
        cb(null, new gutil.File(opts));
      } else {
        cb(err);
      }

      return;
    }

    cb(null, manifest);
  });
}

function transformFilename(file, options) {
  // save the old path for later
  file.revOrigPath = file.path;
  file.revHash = revHash(file.contents);

  options.omit.some(function(omitPath) {
    omitPath = omitPath.replace(/\\/g, '/');
    if(omitPath.indexOf(file.cwd) !== 0) {
      omitPath = path.join(file.cwd, omitPath);
    }
    if(file.path.indexOf(omitPath) === 0) {
      file.base = omitPath;
      return true;
    }
  });

  file.path = modifyFilename(file.path, function (filename, extension) {
    var extIndex = filename.indexOf('.');

    filename = extIndex === -1 ?
      revPath(filename, file.revHash) :
      revPath(filename.slice(0, extIndex), file.revHash) + filename.slice(extIndex);

    return filename + extension;
  });
}

var plugin = function (options) {
  var sourcemaps = [];
  var pathMap = {};
  options.omit = options.omit ? [].concat(options.omit) : [];

  function transform(file, enc, cb) {
    if (file.isNull()) {
      cb(null, file);
      return;
    }

    if (file.isStream()) {
      cb(new gutil.PluginError('gulp-rev', 'Streaming not supported'));
      return;
    }

    // this is a sourcemap, hold until the end
    if (path.extname(file.path) === '.map') {
      sourcemaps.push(file);
      cb();
      return;
    }

    var oldPath = file.path;
    transformFilename(file, options);
    pathMap[oldPath] = file.revHash;

    cb(null, file);
  }

  function flush(cb) {
    sourcemaps.forEach(function (file) {
      var reverseFilename;

      // attempt to parse the sourcemap's JSON to get the reverse filename
      try {
        reverseFilename = JSON.parse(file.contents.toString()).file;
      } catch (err) {}

      if (!reverseFilename) {
        reverseFilename = path.relative(path.dirname(file.path), path.basename(file.path, '.map'));
      }

      if (pathMap[reverseFilename]) {
        // save the old path for later
        file.revOrigPath = file.path;

        var hash = pathMap[reverseFilename];
        file.path = revPath(file.path.replace(/\.map$/, ''), hash) + '.map';
      } else {
        transformFilename(file);
      }

      this.push(file);
    }, this);

    cb();
  }

  return through.obj(transform, flush);
};

plugin.manifest = function (pth, opts) {
  if (typeof pth === 'string') {
    pth = {path: pth};
  }

  opts = objectAssign({
    manifestPath: 'rev-manifest.json',
    merge: false
  }, opts, pth);

  opts.path = opts.manifestPath;
  opts.base = path.dirname(opts.manifestPath);

  var manifest = {};

  function transform(file, enc, cb) {
    // ignore all non-rev'd files
    if (!file.path || !file.revOrigPath) {
      cb();
      return;
    }

    var revisionedFile = relPath(file.base, file.path);
    var originalFile = path.join(path.dirname(revisionedFile), path.basename(file.revOrigPath)).replace(/\\/g, '/');

    manifest[originalFile] = revisionedFile;

    cb();
  }

  function flush(cb) {
    // no need to write a manifest file if there's nothing to manifest
    if (Object.keys(manifest).length === 0) {
      cb();
      return;
    }

    getManifestFile(opts, function (err, manifestFile) {
      if (err) {
        cb(err);
        return;
      }

      if (opts.merge && !manifestFile.isNull()) {
        var oldManifest = {};

        try {
          oldManifest = JSON.parse(manifestFile.contents.toString());
        } catch (err) {}

        manifest = objectAssign(oldManifest, manifest);
      }

      manifestFile.contents = new Buffer(JSON.stringify(sortKeys(manifest), null, '  '));
      this.push(manifestFile);
      cb();
    }.bind(this));
  }

  return through.obj(transform, flush);
};

module.exports = plugin;
