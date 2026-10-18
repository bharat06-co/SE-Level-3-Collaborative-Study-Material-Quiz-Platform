const request = require('supertest');
const { createApp } = require('../src/app');
const { createAttemptService } = require('../src/modules/attempts/attempt.service');
const { scoreAnswers } = require('../src/modules/attempts/scoring.service');
const { getAttemptModel } = require('../src/modules/attempts/attempt.model');
const { createAttemptRepository } = require('../src/modules/attempts/attempt.repo');
const QUIZ = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const STUDENT = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const ATTEMPT = 'cccccccccccccccccccccccc';
const at = new Date('2026-10-17T09:00:00.000Z');
function questions() {
  return [
    { _id: 'q1', type: 'mcq', options: ['A', 'B', 'C'], answerKey: 2 },
    { _id: 'q2', type: 'true_false', answerKey: false },
    { _id: 'q3', type: 'mcq', options: ['A', 'B'], answerKey: 1 },
  ];
}
function setup({ role = 'student', contributor = false, authenticated = true, quiz, existing = false, insertError, identity } = {}) {
  const repository = {
    findPublishedQuiz: jest.fn().mockResolvedValue(quiz === undefined ? { _id: QUIZ, allowRetake: false, questions: questions() } : quiz),
    hasAttempt: jest.fn().mockResolvedValue(existing),
    insertAttempt: jest.fn().mockImplementation(async () => {
      if (insertError) throw insertError;
      return { id: ATTEMPT, submittedAt: at };
    }),
  };
  const authenticate = (req, res, next) => {
    if (authenticated) req.auth = identity || { userId: STUDENT, role, contributor };
    next();
  };
  const service = createAttemptService({ repository, now: () => at });
  const app = createApp({ attempts: { authenticate, service } });
  const post = (body = { answers: [] }, id = QUIZ) => request(app).post(`/api/v1/quizzes/${id}/attempts`).send(body);
  return { app, post, repository, service };
}
describe('FR-030 submission HTTP module (auth context injected in tests only)', () => {
  test('201 includes persisted ID and SAD result shape, with no storage internals', async () => {
    const { post, repository } = setup();
    const response = await post({ answers: [{ questionId: 'q1', response: 2 }, { questionId: 'q2', response: true }, { questionId: 'q3', response: null }] });
    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({ attemptId: ATTEMPT, score: 1, maxScore: 3, percentage: 33.3, submittedAt: at.toISOString(), results: [
      { questionId: 'q1', isCorrect: true, correctAnswer: 2 },
      { questionId: 'q2', isCorrect: false, correctAnswer: false },
      { questionId: 'q3', isCorrect: false, unanswered: true, correctAnswer: 1 },
    ] });
    expect(repository.insertAttempt).toHaveBeenCalledWith(expect.objectContaining({ studentId: STUDENT, quizId: QUIZ, score: 1, maxScore: 3, retakeGuard: `${QUIZ}:${STUDENT}` }));
  });
  test('contributors can submit as students', async () => { expect((await setup({ contributor: true }).post()).status).toBe(201); });
  test.each(['educator', 'administrator', 'admin'])('%s cannot submit', async (role) => {
    const { post, repository } = setup({ role });
    expect((await post()).status).toBe(403);
    expect(repository.findPublishedQuiz).not.toHaveBeenCalled();
  });
  test('missing auth context is 401', async () => { expect((await setup({ authenticated: false }).post()).status).toBe(401); });
  test('invalid server identity is 401', async () => { expect((await setup({ identity: { userId: 'bad', role: 'student' } }).post()).status).toBe(401); });
  test('default application fails closed even with forged bearer/header/body identities', async () => {
    const response = await request(createApp()).post(`/api/v1/quizzes/${QUIZ}/attempts`).set('Authorization', 'Bearer fake-student-token').set('X-User-Id', STUDENT).send({ answers: [], userId: STUDENT, role: 'student', auth: { userId: STUDENT, role: 'student' } });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
    expect(response.body.results).toBeUndefined();
  });
  test('missing/draft/unpublished lookup returns 404 and inserts nothing', async () => {
    const { post, repository } = setup({ quiz: null });
    const response = await post();
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('QUIZ_NOT_AVAILABLE');
    expect(repository.insertAttempt).not.toHaveBeenCalled();
  });
  test('previous attempt with retakes disabled returns 409', async () => {
    const { post, repository } = setup({ existing: true });
    const response = await post();
    expect(response.status).toBe(409); expect(response.body.error.code).toBe('RETAKE_NOT_ALLOWED');
    expect(repository.insertAttempt).not.toHaveBeenCalled();
  });
  test('retakes enabled skips existing-attempt restriction and omits guard', async () => {
    const { post, repository } = setup({ quiz: { allowRetake: true, questions: questions() }, existing: true });
    expect((await post()).status).toBe(201);
    expect(repository.hasAttempt).not.toHaveBeenCalled();
    expect(repository.insertAttempt.mock.calls[0][0].retakeGuard).toBeUndefined();
  });
  test('database unique guard collision returns 409', async () => {
    const { post } = setup({ insertError: Object.assign(new Error('internal'), { code: 11000, keyPattern: { retakeGuard: 1 } }) });
    expect((await post()).body.error.code).toBe('RETAKE_NOT_ALLOWED');
  });
  test.each([new Error('database-password-must-not-leak'), Object.assign(new Error('other duplicate'), { code: 11000, keyPattern: { other: 1 } }), Object.assign(new Error('unknown duplicate'), { code: 11000 })])('write errors never return false success or secrets', async (insertError) => {
    const response = await setup({ insertError }).post();
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(response.body)).not.toContain(insertError.message);
    expect(response.body.results).toBeUndefined();
  });
  test('waits for the actual save before returning', async () => {
    const { service, repository } = setup();
    let resolveSave;
    repository.insertAttempt.mockImplementation(() => new Promise((resolve) => { resolveSave = resolve; }));
    let finished = false;
    const pending = service.submit({ quizId: QUIZ, studentId: STUDENT, answers: [] }).then(() => { finished = true; });
    while (!resolveSave) await new Promise((resolve) => setImmediate(resolve));
    expect(finished).toBe(false);
    resolveSave({ id: ATTEMPT, submittedAt: at }); await pending; expect(finished).toBe(true);
  });
  test('client score, identity and results do not influence storage', async () => {
    const { post, repository } = setup();
    const response = await post({ answers: [], score: 99, studentId: QUIZ, role: 'admin', maxScore: 99, results: ['fake'] });
    expect(response.status).toBe(201); expect(response.body.score).toBe(0);
    expect(repository.insertAttempt.mock.calls[0][0]).toMatchObject({ studentId: STUDENT, score: 0, maxScore: 3 });
  });
  test.each([
    { answers: [{ questionId: 'not-in-quiz', response: 0 }] },
    { answers: [{ questionId: 'q1', response: 0 }, { questionId: 'q1', response: 1 }] },
    { answers: [{ questionId: 'q2', response: 3 }] },
    { answers: [{ questionId: 'q1', response: true }] },
    { answers: [{ questionId: 'q1', response: 3 }] },
    { answers: [{ questionId: 'q1', response: -1 }] },
    { answers: [{ questionId: 'q1', response: 1.2 }] },
    { answers: [{ questionId: 'q1', response: '2' }] },
    { answers: [{ questionId: 'q1', response: { $gt: '' } }] },
    { answers: [{ questionId: 'q1', response: [], isCorrect: true }] },
    { answers: [{ questionId: '' }] },
    { answers: 'bad' }, {}, null, [],
  ])('invalid body is 400 with no write: %j', async (body) => {
    const { post, repository } = setup();
    const response = await post(body);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.length).toBeGreaterThan(0);
    expect(repository.insertAttempt).not.toHaveBeenCalled();
  });
  test('invalid quiz ID fails validation before database access', async () => {
    const { post, repository } = setup();
    expect((await post({ answers: [] }, 'bad-id')).status).toBe(400);
    expect(repository.findPublishedQuiz).not.toHaveBeenCalled();
  });
  test('uppercase route/identity IDs are normalized for guard keys', async () => {
    const { post, repository } = setup({ identity: { userId: STUDENT.toUpperCase(), role: 'student' } });
    expect((await post({ answers: [] }, QUIZ.toUpperCase())).status).toBe(201);
    expect(repository.insertAttempt.mock.calls[0][0].retakeGuard).toBe(`${QUIZ}:${STUDENT}`);
  });
  test('broken server quiz policy fails closed', async () => { expect((await setup({ quiz: { questions: questions() } }).post()).status).toBe(500); });
});
describe('Pure scoring required by submission (FR-031 supporting code)', () => {
  test('five questions: 3 correct, 1 incorrect, 1 omitted => 3/5', () => {
    const qs = [ ...questions(), { _id: 'q4', type: 'true_false', answerKey: true }, { _id: 'q5', type: 'true_false', answerKey: true } ];
    const result = scoreAnswers(qs, [{ questionId: 'q1', response: 2 }, { questionId: 'q2', response: false }, { questionId: 'q3', response: 1 }, { questionId: 'q4', response: false }]);
    expect(result.score).toBe(3); expect(result.maxScore).toBe(5); expect(result.percentage).toBe(60);
    expect(result.storedAnswers.map((a) => a.isCorrect)).toEqual([true, true, true, false, false]);
    expect(result.results[4].unanswered).toBe(true);
  });
  test('all correct, including false and index zero', () => {
    const qs = [{ _id: 'a', type: 'mcq', options: ['A', 'B'], answerKey: 0 }, { _id: 'b', type: 'true_false', answerKey: false }];
    expect(scoreAnswers(qs, [{ questionId: 'a', response: 0 }, { questionId: 'b', response: false }]).score).toBe(2);
  });
  test('empty answers, missing responses and explicit null are all unanswered', () => {
    for (const answers of [[], [{ questionId: 'q1' }], [{ questionId: 'q1', response: null }]]) {
      const result = scoreAnswers(questions(), answers); expect(result.score).toBe(0); expect(result.results.every((a) => a.unanswered)).toBe(true);
    }
  });
  test('does not mutate caller data and snapshots survive a changed answer key', () => {
    const qs = questions(); const before = JSON.stringify(qs);
    const result = scoreAnswers(qs, [{ questionId: 'q1', response: 2 }]);
    expect(JSON.stringify(qs)).toBe(before); qs[0].answerKey = 0;
    expect(result.storedAnswers[0].correctAnswer).toBe(2); expect(result.score).toBe(1);
  });
  test.each([undefined, [], [null], [{ type: 'mcq' }], [{ _id: '', type: 'true_false', answerKey: true }], [{ _id: 'a', type: 'essay', answerKey: 'x' }], [{ _id: 'a', type: 'mcq', options: ['one'], answerKey: 0 }], [{ _id: 'a', type: 'true_false', answerKey: true }, { _id: 'a', type: 'true_false', answerKey: false }]])('corrupt server quiz rejects rather than fabricate results: %j', (qs) => { expect(() => scoreAnswers(qs, [])).toThrow(); });
});
describe('Attempt persistence contract', () => {
  test('schema uses SAD collection/indexes and rejects unknown fields', () => {
    const model = getAttemptModel(); expect(model.collection.name).toBe('attempts');
    expect(getAttemptModel()).toBe(model);
    const indexes = model.schema.indexes();
    expect(indexes).toEqual(expect.arrayContaining([
      expect.arrayContaining([{ quizId: 1, studentId: 1, score: -1 }]),
      expect.arrayContaining([{ studentId: 1, submittedAt: -1 }]),
    ]));
    const guard = indexes.find(([keys]) => keys.retakeGuard === 1);
    expect(guard[1]).toMatchObject({ unique: true, partialFilterExpression: { retakeGuard: { $type: 'string' } } });
    expect(() => new model({ unknown: true })).toThrow();
  });
  test('repository queries fixed collection/IDs, awaits indexes and returns saved values', async () => {
    const model = getAttemptModel();
    const indexes = jest.spyOn(model, 'createIndexes').mockResolvedValue([]);
    const exists = jest.spyOn(model, 'exists').mockResolvedValue({ _id: ATTEMPT });
    const create = jest.spyOn(model, 'create').mockResolvedValue({ _id: ATTEMPT, submittedAt: at });
    const findOne = jest.fn().mockResolvedValue({ allowRetake: true });
    const collection = jest.fn().mockReturnValue({ findOne });
    const repo = createAttemptRepository({ connection: { models: { Attempt: model }, collection } });
    expect(await repo.findPublishedQuiz(QUIZ)).toEqual({ allowRetake: true });
    expect(collection).toHaveBeenCalledWith('quizzes');
    expect(String(findOne.mock.calls[0][0]._id)).toBe(QUIZ);
    expect(findOne.mock.calls[0][0].status).toBe('published');
    expect(await repo.hasAttempt(QUIZ, STUDENT)).toBe(true);
    expect(await repo.insertAttempt({ score: 1 })).toEqual({ id: ATTEMPT, submittedAt: at });
    await repo.insertAttempt({ score: 2 }); expect(indexes).toHaveBeenCalledTimes(1);
    indexes.mockRestore(); exists.mockRestore(); create.mockRestore();
  });
  test('failed index setup is propagated and can retry, never silently skipped', async () => {
    const model = getAttemptModel();
    const indexes = jest.spyOn(model, 'createIndexes').mockRejectedValueOnce(new Error('index unavailable')).mockResolvedValueOnce([]);
    const create = jest.spyOn(model, 'create').mockResolvedValue({ _id: ATTEMPT, submittedAt: at });
    const repo = createAttemptRepository();
    await expect(repo.insertAttempt({})).rejects.toThrow('index unavailable'); expect(create).not.toHaveBeenCalled();
    await expect(repo.insertAttempt({})).resolves.toMatchObject({ id: ATTEMPT });
    indexes.mockRestore(); create.mockRestore();
  });
});

describe('FR-031 five-question boundaries and private quiz adapter',()=>{
 test('five blank answers score 0/5; five correct answers score 5/5',()=>{
   const qs=Array.from({length:5},(_,i)=>({_id:`five-${i}`,type:'true_false',answerKey:i%2===0}));
   expect(scoreAnswers(qs,[])).toMatchObject({score:0,maxScore:5,percentage:0});
   const answers=qs.map(q=>({questionId:q._id,response:q.answerKey}));
   const saved=scoreAnswers(qs,answers);expect(saved).toMatchObject({score:5,maxScore:5,percentage:100});expect(saved.results.every(r=>r.isCorrect)).toBe(true);
 });
 test('optional private lookup delegates to reviewed quiz service without a second Quiz model',async()=>{
   const findQuizForScoring=jest.fn().mockResolvedValue({_id:QUIZ,status:'published',allowRetake:true,questions:questions()});
   const repo=createAttemptRepository({findQuizForScoring});await expect(repo.findPublishedQuiz(QUIZ)).resolves.toMatchObject({status:'published'});expect(findQuizForScoring).toHaveBeenCalledWith(QUIZ);
 });
});
