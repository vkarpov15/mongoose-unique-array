'use strict';

var arrayUniquePlugin = require('../');
var assert = require('assert');
var mongodb = require('mongodb');
var mongoose = require('mongoose');

describe('API', function() {
  let client;

  before(function(done) {
    const uri = 'mongodb://localhost:27017/test';
    mongoose.connect(uri, { useNewUrlParser: true });
    mongodb.MongoClient.connect(uri, function(error, _client) {
      assert.ifError(error);
      client = _client;
      done();
    });
  });

  beforeEach(() => {
    client.db().collection('tests').deleteMany({});
    client.db().collection('test3').deleteMany({});
  });

  after(function() {
    mongoose.disconnect();
    client.close();
  });

  /**
   * If you set the `unique` property to `true` on a schema path, this plugin
   * will add a custom validator that ensures the array values are unique before
   * saving.
   */
  it('Basic Example', async function() {
    const schema = new mongoose.Schema({
      arr: [{ type: String, unique: true }],
      docArr: [{ name: { type: String, unique: true } }]
    });

    // Attach the plugin to the schema
    schema.plugin(arrayUniquePlugin);
    const M = mongoose.model('Test', schema);

    const doc = await M.create({});
    doc.arr.push('test');
    doc.docArr.push({ name: 'test' });
    await doc.save();

    doc.arr.push('test');
    const error = await doc.save().then(() => null, err => err);
    // MongooseError: Duplicate values in array `arr`: [test,test]
    assert.ok(error.errors['arr'].message.indexOf('Duplicate values') !== -1,
      error.errors['arr'].message);
  });

  it('Pushing a new item to existing docArr and then calling save causes version error', async function() {
    const schema = new mongoose.Schema({
      arr: [{ type: String, unique: true }],
      docArr: [{ name: { type: String, unique: true } }]
    });

    // Attach the plugin to the schema
    schema.plugin(arrayUniquePlugin);
    const M = mongoose.model('Test3', schema);

    const doc = await M.create({});
    doc.arr.push('test');
    doc.docArr.push({ name: 'test' });
    await doc.save();

    doc.docArr.push({ name: 'something else' });
    await doc.save();
  });

  /**
   * In mongoose, [`unique` is not a validator](http://mongoosejs.com/docs/validation.html#the-unique-option-is-not-a-validator),
   * but a shorthand for creating a [unique index in MongoDB](https://docs.mongodb.com/manual/core/index-unique/).
   * The unique index on `arr` in the previous example would prevent multiple documents from
   * having the value 'test' in `arr`, but would _not_ prevent a single document from having
   * multiple instances of the value 'test' in `arr`.
   */
  it('Why a Separate Plugin?', async function() {
    const schema = new mongoose.Schema({
      arr: [{ type: String, unique: true }]
    });

    // Do *not* attach the plugin
    // schema.plugin(arrayUniquePlugin);
    const M = mongoose.model('Test2', schema);

    // Since `unique` creates an index, need to wait for the index to finish
    // building before the `unique` constraint kicks in.
    await M.init();

    // acquit:ignore:start
    await M.deleteMany({});
    // acquit:ignore:end

    const doc = await M.create({ arr: ['test'] });
    doc.arr.push('test');
    // No error! That's because, without this plugin, a single doc can have
    // duplicate values in `arr`. However, if you tried to `save()`
    // a separate document with the value 'test' in `arr`, it will fail.
    await doc.save();
  });

  /**
   * This plugin attaches a custom validator to handle duplicate array entries.
   * However, there is an additional edge case to handle: calling `push()` on
   * an array translates into a [`$push` in MongoDB](https://docs.mongodb.com/manual/reference/operator/update/push/),
   * so if you have multiple copies of a document calling `push()` at the same
   * time, the custom validator won't catch it. This plugin will surface a
   * separate error for this case.
   */
  it('Caveat With `push()`', async function() {
    // acquit:ignore:start
    const schema = new mongoose.Schema({
      arr: [{ type: String, unique: true }],
      docArr: [{ name: { type: String, unique: true } }]
    });

    // Attach the plugin to the schema
    schema.plugin(arrayUniquePlugin);
    mongoose.deleteModel(/Test/);
    const M = mongoose.model('Test', schema);
    await M.init();
    await M.deleteMany({});
    // acquit:ignore:end
    // Create a document with an empty `arr`
    const doc = await M.create({});

    const doc1 = await M.findById(doc);
    const doc2 = await M.findById(doc);

    // `push()` and `save()` on the first doc. Now `doc2` is out of date,
    // it doesn't know that `doc1` pushed 'test'.
    doc1.arr.push('test');
    await doc1.save();

    doc2.arr.push('test');
    const error = await doc2.save().then(() => null, err => err);
    // Because of plugin, you'll get the below error
    // VersionError: No matching document found for id "59192cbac4fd9871f28f4d61"
    // acquit:ignore:start
    assert.ok(error);
    assert.ok(error.message.indexOf('No matching document') !== -1,
      error.message);
    // acquit:ignore:end
  });

  it('unusable With `push()`', async function() {
    // acquit:ignore:start
    const schema = new mongoose.Schema({
      arr: [{ type: String, unique: true }],
      docArr: [{ name: { type: String, unique: true } }]
    });

    // Attach the plugin to the schema
    schema.plugin(arrayUniquePlugin);
    mongoose.deleteModel(/Test/);
    const M = mongoose.model('Test', schema);
    await M.init();
    await M.deleteMany({});
    // acquit:ignore:end
    // Create a document with an empty `arr`
    const doc = await M.create({});

    const doc1 = await M.findById(doc);
    // const doc2 = await M.findById(doc);

    // `push()` and `save()` on the first doc. Now `doc2` is out of date,
    // it doesn't know that `doc1` pushed 'test'.
    doc1.docArr.push({name:'test'});
    await doc1.save();

    const doc2 = await M.findById(doc);

    doc2.docArr.push({name:'test2'});
    const error = await doc2.save().then(() => null, err => err);
    // Because of plugin, you'll get the below error
    // VersionError: No matching document found for id "59192cbac4fd9871f28f4d61"
    // acquit:ignore:start
    assert.ok(error);
    assert.ok(error.message.indexOf('No matching document') !== -1,
      error.message);
    // acquit:ignore:end
  });
});
