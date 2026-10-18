import { http } from '../src/api/http';
import { loadAttemptQuiz, submitAttempt, parseQuiz, parseAttemptResult } from '../src/features/attempts/attemptApi';
import { quiz, quizId, result } from './attemptFixtures';
jest.mock('../src/api/http', () => ({ http: { get: jest.fn(), post: jest.fn() } }));
test('loads real quiz endpoint, forwards abort signal, strips answer keys', async () => {
 const data = quiz();data.questions[0].answerKey=0;data.secret='not public';http.get.mockResolvedValue({data});
 const signal=new AbortController().signal;const q=await loadAttemptQuiz(quizId,{signal});
 expect(http.get).toHaveBeenCalledWith(`/quizzes/${quizId}`,{signal});expect(JSON.stringify(q)).not.toContain('answerKey');expect(q.secret).toBeUndefined();
 await loadAttemptQuiz(quizId);
});
test.each([quiz({status:'draft'}),quiz({id:'cccccccccccccccccccccccc'}),quiz({questions:[]}),quiz({questions:[quiz().questions[0],quiz().questions[0]]})])('rejects invalid/private/unavailable quiz responses', data=>{expect(()=>parseQuiz(data,quizId)).toThrow();});
test('invalid route ID makes no request',async()=>{await expect(loadAttemptQuiz('bad')).rejects.toThrow();expect(http.get).not.toHaveBeenCalled();});
test('posts only answers, uses signal, returns server data without automatic retry',async()=>{
 http.post.mockResolvedValue({data:result()});const answers=[{questionId:'q1',response:0}];const signal=new AbortController().signal;
 expect(await submitAttempt(quizId,answers,{signal})).toEqual(result());expect(http.post).toHaveBeenCalledWith(`/quizzes/${quizId}/attempts`,{answers},{signal});
 await submitAttempt(quizId,[]);http.post.mockRejectedValue(new Error('timeout'));await expect(submitAttempt(quizId,[])).rejects.toThrow('timeout');expect(http.post).toHaveBeenCalledTimes(3);
});
test('accepts a complete result only after submission',()=>{expect(parseAttemptResult(result(),quiz())).toEqual(result());});
test.each([
 result({score:3}), result({maxScore:4}), result({percentage:67}), result({results:[]}),
 result({results:[...result().results.slice(0,2),result().results[0]]}),
 result({results:result().results.map((r,i)=>i===0?{...r,questionId:'unknown'}:r)}),
 result({results:result().results.map((r,i)=>i===0?{...r,correctAnswer:8}:r)}),
 result({results:result().results.map((r,i)=>i===1?{...r,correctAnswer:0}:r)}),
 result({results:result().results.map((r,i)=>i===0?{...r,unanswered:true}:r)}),
])('rejects incomplete or inconsistent feedback',data=>{expect(()=>parseAttemptResult(data,quiz())).toThrow();});
