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
    db = mongoose.createConnection('mongodb://localhost:27017/mongoose_test', {
      useNewUrlParser: true
    });
  });

  beforeEach(function(done) {
    db.dropDatabase(done);
  });

  after(function() {
    db.close();
  });

  it('pushing onto doc array', function(done) {
    var schema = new mongoose.Schema({
      docArr: [{ name: { type: String, unique: true } }]
    });
    schema.plugin(arrayUnique);
    var M = db.model('T2', schema);

    M.create({}, function(error, doc) {
      assert.ifError(error);
      doc.docArr.push({ name: 'test' });
      doc.save(function(error) {
        assert.ifError(error);
        doc.docArr.push({ name: 'test' });
        doc.save(function(error) {
          assert.ok(error);
          assert.ok(error.errors['docArr'].message.indexOf('Duplicate values') !== -1,
            error.errors['docArr'].message);
          done();
        });
      });
    });
  });

  it('with race condition', function(done) {
    var schema = new mongoose.Schema({
      arr: [{ type: String, unique: true }]
    });
    schema.plugin(arrayUnique);
    var M = db.model('T3', schema);

    M.create({}, function(error, doc) {
      assert.ifError(error);
      M.findById(doc, function(error, doc1) {
        M.findById(doc, function(error, doc2) {
          doc1.arr.push('test');
          doc1.save(function(error) {
            assert.ifError(error);
            doc2.arr.push('test');
            doc2.save(function(error) {
              assert.ok(error);
              assert.ok(error.message.indexOf('No matching document') !== -1,
                error.message);
              done();
            });
          });
        });
      });
    });
  });

  it('with new docs', function(done) {
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

    m.save(function(error) {
      assert.ok(error);
      assert.ok(error.errors['arr'].message.indexOf('Duplicate values') !== -1,
        error.errors['arr'].message);
      assert.ok(error.errors['docArr'].message.indexOf('Duplicate values') !== -1,
        error.errors['docArr'].message);
      done();
    });
  });

  it('nested', function(done) {
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

    m.save(function(error) {
      assert.ok(error);
      assert.ok(error.errors['nested.arr'].message.indexOf('Duplicate values') !== -1,
        error.errors['nested.arr'].message);
      assert.ok(error.errors['nested.docArr'].message.indexOf('Duplicate values') !== -1,
        error.errors['nested.docArr'].message);
      done();
    });
  });

  it('with array set to null (gh-1)', function() {
    const schema = new mongoose.Schema({
      arr: [{ type: String, unique: true }]
    });
    schema.plugin(arrayUnique);
    const M = db.model('gh1', schema);

    return M.create({ arr: ['foo'] }).
      then(res => {
        res.arr = null;
        // Should succeed
        return res.save();
      });
  });
});
