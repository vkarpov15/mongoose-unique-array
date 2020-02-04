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
              // handle private API changes for mongoose >= 5.5.14 Automattic/mongoose#7870
              var arr = (this.$__getValue || this.getValue).call(this, path + '.' + _path);
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
    var numDocArrayPaths;
    var uniqueDocArrPaths;

    if (this.isNew) {
      // New doc, already verified existing arrays have no dups
      return next();
    }

    const dirty = this.$__dirty();
    const len = dirty.length;

    for (let i = 0; i < len; ++i) {
      const dirt = dirty[i];
      if (!uniquePrimitiveArrayPaths[dirt.path] &&
          !uniqueDocumentArrayPaths[dirt.path]) {
        continue;
      }
      if (!has$push(dirt) || dirt.value._atomics.$push.$each == null) {
        continue;
      }

      if (uniquePrimitiveArrayPaths[dirt.path]) {
        this.$where = this.$where || {};
        this.$where[dirt.path] = { $nin: dirt.value._atomics.$push.$each };
      } else {
        this.$where = this.$where || {};
        uniqueDocArrPaths = uniqueDocumentArrayPaths[dirt.path];
        numDocArrayPaths = uniqueDocArrPaths.length;
        for (let j = 0; j < numDocArrayPaths; ++j) {
          this.$where[dirt.path + '.' + uniqueDocArrPaths[j]] = {
            $nin: dirt.value.map(function(subdoc) {
              return subdoc.get(uniqueDocArrPaths[j]);
            })
          };
        }
      }
    }

    this.$__dirty().forEach(dirt => {
      if (has$push(dirt) && dirt.value._atomics.$push.$each != null) {
        this.$where = this.$where || {};
        if (dirt.schema.$isMongooseDocumentArray) {
          this.$where[dirt.path + '._id'] = {
            $nin: dirt.value._atomics.$push.$each.map(function(doc) {
              return doc._id;
            })
          };
        } else {
          this.$where[dirt.path] = { $nin: dirt.value._atomics.$push.$each };
        }
      }
    });
    next();
  });
};

function has$push(dirt) {
  return dirt.value != null &&
    dirt.value._atomics != null &&
    '$push' in dirt.value._atomics;
}

function hasDuplicates(arr) {
  if (!arr) {
    return false;
  }
  var len = arr.length;
  var map = {};
  var mapId = {};
  var el;

  for (var i = 0; i < len; ++i) {
    el = arr[i];

    if (map[el.toString()] || (el.id && mapId[el.id])) {
      return true;
    }
    map[el.toString()] = true;
    if(el.id) mapId[el.id] = true;
  }
  return false;
}
