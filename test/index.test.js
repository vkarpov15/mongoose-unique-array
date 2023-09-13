'use strict';

var arrayUnique = require('../');
var assert = require('assert');
var mongoose = require('mongoose');

if (process.env.D) {
  mongoose.set('debug', true);
}

describe('arrayUnique', function() {
  let db;

  before(function() {
    db = mongoose.createConnection('mongodb://127.0.0.1:27017/mongoose_test');
  });

  beforeEach(async function() {
    await db.dropDatabase();
  });

  after(function() {
    db.close();
  });

  it('pushing onto doc array', async function() {
    var schema = new mongoose.Schema({
      docArr: [{ name: { type: String, unique: true } }]
    });
    schema.plugin(arrayUnique);
    var M = db.model('T2', schema);

    const doc = await M.create({});
    doc.docArr.push({ name: 'test' });
    await doc.save();
    doc.docArr.push({ name: 'test' });
    await doc.save().catch(error => {
      assert.ok(error.errors['docArr'].message.indexOf('Duplicate values') !== -1, error.errors['docArr'].message);
    });
  });

  it('with race condition', async function() {
    var schema = new mongoose.Schema({
      arr: [{ type: String, unique: true }]
    });
    schema.plugin(arrayUnique);
    var M = db.model('T3', schema);

    const doc = await M.create({});
    const doc1 = await M.findById(doc);
    const doc2 = await M.findById(doc1);
    doc1.arr.push('test');
    await doc1.save();
    doc2.arr.push('test');
    await doc2.save().catch(error => {
      assert.ok(error.message.indexOf('No matching document') !== -1, error.message);
    });
  });

  it('with new docs', async function() {
    var schema = new mongoose.Schema({
      arr: [{ type: String, unique: true }],
      docArr: [{ name: { type: String, unique: true } }]
    });
    schema.plugin(arrayUnique);
    var M = db.model('T4', schema);
    var m = new M({
      arr: ['test', 'test'],
      docArr: [{ name: 'test' }, { name: 'test' }]
    });

    await m.save().catch(error => {
      assert.ok(error);
      assert.ok(error.errors['arr'].message.indexOf('Duplicate values') !== -1,
        error.errors['arr'].message);
      assert.ok(error.errors['docArr'].message.indexOf('Duplicate values') !== -1,
        error.errors['docArr'].message);
    });
  });

  it('nested', async function() {
    var schema = new mongoose.Schema({
      nested: {
        arr: [{ type: String, unique: true }],
        docArr: [{ name: { type: String, unique: true } }]
      }
    });
    schema.plugin(arrayUnique);
    var M = db.model('T5', schema);
    var m = new M({
      nested: {
        arr: ['test', 'test'],
        docArr: [{ name: 'test' }, { name: 'test' }]
      }
    });
    await m.save().catch(error => {
      assert.ok(error);
      assert.ok(error.errors['nested.arr'].message.indexOf('Duplicate values') !== -1,
        error.errors['nested.arr'].message);
      assert.ok(error.errors['nested.docArr'].message.indexOf('Duplicate values') !== -1,
        error.errors['nested.docArr'].message);
    });
  });

  it('with array set to null (gh-1)', async function() {
    const schema = new mongoose.Schema({
      arr: [{ type: String, unique: true }]
    });
    schema.plugin(arrayUnique);
    const M = db.model('gh1', schema);

    const doc = await M.create({ arr: ['foo'] });
    doc.arr = null;
    await doc.save();
    assert.ok(doc);
    assert.equal(doc.arr, null);
  });
});
