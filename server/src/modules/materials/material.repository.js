const { Material } = require('../../models/Material');

function createMaterialRepository({ model = Material } = {}) {
  async function create(document) {
    return model.create(document);
  }
  return { create };
}

module.exports = { createMaterialRepository };
