'use strict';

var SchemaArray = require('mongoose').Schema.Types.Array;

module.exports = function(schema) {
  schema.options.saveErrorIfNotFound = true;

  var paths = schema.paths;
  var arrayKeys = Object.keys(paths);

  var uniqueDocumentArrayPaths = {};
  arrayKeys.
    filter(function(path) { return paths[path].$isMongooseDocumentArray; }).
    forEach(function(path) {
      var arrSchema = paths[path].schema;
      var arrPaths = Object.keys(arrSchema.paths);
      arrPaths.forEach(function(_path) {
        if (arrSchema.paths[_path].options.unique) {
          uniqueDocumentArrayPaths[path] = uniqueDocumentArrayPaths[path] || [];
          uniqueDocumentArrayPaths[path].push(_path);

          schema.path(path).validate({
            validator: function() {
              var arr = this.getValue(path + '.' + _path);
              var dup = hasDuplicates(arr);
              if (dup) {
                return false;
              }
              return true;
            },
            message: 'Duplicate values in array `' + _path + '`: [{VALUE}]'
          });
        }
      });
    });

  var uniquePrimitiveArrayPaths = {};
  arrayKeys.forEach(function(path) {
    if (paths[path] instanceof SchemaArray &&
        !paths[path].$isMongooseDocumentArray &&
        paths[path].caster.options.unique) {
      uniquePrimitiveArrayPaths[path] = true;

      schema.path(path).validate({
        validator: function(arr) {
          var dup = hasDuplicates(arr);
          if (dup) {
            return false;
          }
          return true;
        },
        message: 'Duplicate values in array `' + path + '`: [{VALUE}]'
      });
    }
  });

  schema.pre('save', function(next) {
    var dirt;
    var dirty;
    var i = 0;
    var len;
    var j = 0;
    var numDocArrayPaths;
    var uniqueDocArrPaths;
    var arrPaths;

    if (this.isNew) {
      // New doc, already verified existing arrays have no dups
      return next();
    }

    dirty = this.$__dirty();
    len = dirty.length;

    for (i = 0; i < len; ++i) {
      dirt = dirty[i];
      if (!uniquePrimitiveArrayPaths[dirt.path] &&
          !uniqueDocumentArrayPaths[dirt.path]) {
        continue;
      }
      if (!dirt.value._atomics || !('$pushAll' in dirt.value._atomics)) {
        continue;
      }

      if (uniquePrimitiveArrayPaths[dirt.path]) {
        this.$where = this.$where || {};
        this.$where[dirt.path] = { $nin: dirt.value._atomics.$pushAll };
      } else {
        this.$where = this.$where || {};
        uniqueDocArrPaths = uniqueDocumentArrayPaths[dirt.path];
        numDocArrayPaths = uniqueDocArrPaths.length;
        for (j = 0; j < numDocArrayPaths; ++j) {
          this.$where[dirt.path + '.' + uniqueDocArrPaths[j]] = {
            $nin: dirt.value.map(function(subdoc) {
              return subdoc.get(uniqueDocArrPaths[j]);
            })
          };
        }
      }
    }

    this.$__dirty().forEach(dirt => {
      if (dirt.value._atomics && '$pushAll' in dirt.value._atomics) {
        this.$where = this.$where || {};
        if (dirt.schema.$isMongooseDocumentArray) {
          this.$where[dirt.path + '._id'] = {
            $nin: dirt.value._atomics.$pushAll.map(function(doc) {
              return doc._id;
            })
          };
        } else {
          this.$where[dirt.path] = { $nin: dirt.value._atomics.$pushAll };
        }
      }
    });
    next();
  });
};

function hasDuplicates(arr) {
  if (!arr) {
    return false;
  }
  var len = arr.length;
  var map = {};
  var el;

  for (var i = 0; i < len; ++i) {
    el = arr[i];
    if (map[el.toString()]) {
      return true;
    }
    map[el.toString()] = true;
  }

  return false;
}
