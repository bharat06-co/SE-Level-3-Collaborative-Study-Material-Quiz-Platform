const { Material } = require('../../models/Material');

function createMaterialRepository({ model = Material } = {}) {
  async function create(document) {
    return model.create(document);
  }

  async function findById(id) {
    return model.findById(id);
  }

  return { create, findById };
}

module.exports = { createMaterialRepository };
