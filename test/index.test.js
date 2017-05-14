'use strict';

var arrayUnique = require('../');
var assert = require('assert');
var mongoose = require('mongoose');

if (process.env.D) {
  mongoose.set('debug', true);
}

describe('arrayUnique', function() {
  before(function() {
    mongoose.connect('mongodb://localhost:27017/mongoose_test');
  });

  beforeEach(function(done) {
    mongoose.connection.dropDatabase(done);
  });

  it('works', function(done) {
    var schema = new mongoose.Schema({
      arr: [{ type: String, unique: true }],
      docArr: [{ name: { type: String, unique: true } }]
    });
    schema.plugin(arrayUnique);
    var M = mongoose.model('T1', schema);

    M.create({}, function(error, doc) {
      assert.ifError(error);
      doc.arr.push('test');
      doc.docArr.push({ name: 'test' });
      doc.save(function(error) {
        assert.ifError(error);
        doc.arr.push('test');
        doc.save(function(error) {
          assert.ok(error);
          assert.ok(error.errors['arr'].message.indexOf('Duplicate values') !== -1,
            error.errors['arr'].message);
          done();
        });
      });
    });
  });

  it('pushing onto doc array', function(done) {
    var schema = new mongoose.Schema({
      docArr: [{ name: { type: String, unique: true } }]
    });
    schema.plugin(arrayUnique);
    var M = mongoose.model('T2', schema);

    M.create({}, function(error, doc) {
      assert.ifError(error);
      doc.docArr.push({ name: 'test' });
      doc.save(function(error) {
        assert.ifError(error);
        doc.docArr.push('test');
        doc.save(function(error) {
          assert.ok(error);
          assert.ok(error.errors['docArr'].message.indexOf('Duplicate values') !== -1,
            error.errors['docArr'].message);
          done();
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
    var M = mongoose.model('T3', schema);
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
    var M = mongoose.model('T4', schema);
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
});
