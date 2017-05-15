# mongoose-unique-array

Mongoose plugin for enforcing `unique` constraints in arrays

[![CircleCI](https://circleci.com/gh/vkarpov15/mongoose-unique-array/tree/master.svg?style=svg)](https://circleci.com/gh/vkarpov15/mongoose-unique-array/tree/master)

## Usage

Requires `mongoose >= 4.10.0`. Do not use with mongoose 3.x.

```javascript
const arrayUniquePlugin = require('mongoose-unique-array');
```


# API

## Basic Example


If you set the `unique` property to `true` on a schema path, this plugin
will add a custom validator that ensures the array values are unique before
saving.


```javascript

    const schema = new mongoose.Schema({
      arr: [{ type: String, unique: true }],
      docArr: [{ name: { type: String, unique: true } }]
    });

    // Attach the plugin to the schema
    schema.plugin(arrayUniquePlugin);
    const M = mongoose.model('Test', schema);

    M.create({}, function(error, doc) {
      assert.ifError(error);
      doc.arr.push('test');
      doc.docArr.push({ name: 'test' });
      doc.save(function(error) {
        assert.ifError(error);
        doc.arr.push('test');
        doc.save(function(error) {
          assert.ok(error);
          // MongooseError: Duplicate values in array `arr`: [test,test]
          assert.ok(error.errors['arr'].message.indexOf('Duplicate values') !== -1,
            error.errors['arr'].message);
        });
      });
    });
  
```

## Why a Separate Plugin?

In mongoose, [`unique` is not a validator](http://mongoosejs.com/docs/validation.html#the-unique-option-is-not-a-validator),
but a shorthand for creating a [unique index in MongoDB](https://docs.mongodb.com/manual/core/index-unique/).
The unique index on `arr` in the previous example would prevent multiple documents from
having the value 'test' in `arr`, but would _not_ prevent a single document from having
multiple instances of the value 'test' in `arr`.


```javascript

    const schema = new mongoose.Schema({
      arr: [{ type: String, unique: true }]
    });

    // Do *not* attach the plugin
    // schema.plugin(arrayUniquePlugin);
    const M = mongoose.model('Test2', schema);

    // Since `unique` creates an index, need to wait for the index to finish
    // building before the `unique` constraint kicks in.
    M.on('index', function(error) {
      assert.ifError(error);
      M.create({ arr: ['test'] }, function(error, doc) {
        doc.arr.push('test');
        doc.save(function(error) {
          // No error! That's because, without this plugin, a single doc can have
          // duplicate values in `arr`. However, if you tried to `save()`
          // a separate document with the value 'test' in `arr`, it will fail.
        });
      });
    });
  
```

## Caveat With `push()`

This plugin attaches a custom validator to handle duplicate array entries.
However, there is an additional edge case to handle: calling `push()` on
an array translates into a [`$push` in MongoDB](https://docs.mongodb.com/manual/reference/operator/update/push/),
so if you have multiple copies of a document calling `push()` at the same
time, the custom validator won't catch it. This plugin will surface a
separate error for this case.


```javascript

    const M = mongoose.model('Test');

    // Create a document with an empty `arr`
    M.create({}, function(error, doc) {
      assert.ifError(error);
      // Get 2 copies of the same underlying document
      M.findById(doc, function(error, doc1) {
        M.findById(doc, function(error, doc2) {
          // `push()` and `save()` on the first doc. Now `doc2` is out of date,
          // it doesn't know that `doc1` pushed 'test'.
          doc1.arr.push('test');
          doc1.save(function(error) {
            assert.ifError(error);
            doc2.arr.push('test');
            doc2.save(function(error) {
              // Because of plugin, you'll get the below error
              // VersionError: No matching document found for id "59192cbac4fd9871f28f4d61"
            });
          });
        });
      });
    });
  
```