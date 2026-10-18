function createAttemptController(service) {
  return async (req, res) => {
    const result = await service.submit({ ...req.attemptInput, studentId: req.attemptStudentId });
    res.set('Cache-Control', 'no-store');
    res.status(201).json(result);
  };
}
module.exports = { createAttemptController };
