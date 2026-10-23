import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AttemptPage from '../src/features/attempts/AttemptPage';
import { quiz, quizId, result } from './attemptFixtures';
function setup({data=quiz(), saved=result(), loadError, sendError}={}) {
 const loadQuiz=loadError?jest.fn().mockRejectedValue(loadError):jest.fn().mockResolvedValue(data);
 const sendAttempt=sendError?jest.fn().mockRejectedValue(sendError):jest.fn().mockResolvedValue(saved);
 const view=render(<AttemptPage quizId={quizId} loadQuiz={loadQuiz} sendAttempt={sendAttempt}/>);
 return {loadQuiz,sendAttempt,...view};
}
const httpError=status=>({response:{status,data:{error:{code:status===409?'RETAKE_NOT_ALLOWED':'OTHER'}}}});
test('loads only public quiz content with accessible blank choices and no correct-answer feedback',async()=>{
 setup();expect(screen.getByRole('status')).toHaveTextContent('Loading');await screen.findByText('Database basics');
 expect(screen.getByText('0 of 3 answered. Blank answers receive 0 points.')).toBeInTheDocument();expect(screen.queryByText(/Correct answer:/)).not.toBeInTheDocument();
 expect(screen.getAllByRole('radio')).toHaveLength(6);expect(screen.getAllByRole('radio').every(r=>!r.checked)).toBe(true);
 expect(screen.getByRole('button',{name:'Clear answer for question 1'})).toBeDisabled();
});
test('TC-ATT-07: submits 0 and false, displays server feedback immediately without route navigation',async()=>{
 const user=userEvent.setup();const {sendAttempt}=setup();await screen.findByText('Database basics');const href=window.location.href;
 await user.click(screen.getByRole('radio',{name:'Primary key'}));await user.click(screen.getByRole('radio',{name:'False'}));await user.click(screen.getByRole('button',{name:'Submit attempt'}));
 expect(sendAttempt).toHaveBeenCalledWith(quizId,[{questionId:'q1',response:0},{questionId:'q2',response:false}],expect.objectContaining({signal:expect.any(AbortSignal)}));
 expect(await screen.findByRole('heading',{name:'Your results'})).toBeInTheDocument();expect(screen.getByText('2/3')).toBeInTheDocument();
 expect(screen.getAllByText('Correct',{exact:true})).toHaveLength(2);expect(screen.getByText('Unanswered',{exact:true})).toBeInTheDocument();expect(screen.getAllByText(/Correct answer:/)).toHaveLength(3);expect(window.location.href).toBe(href);expect(screen.queryByRole('button',{name:'Submit attempt'})).not.toBeInTheDocument();
});
test('incorrect answer shows correct option text rather than an unexplained index',async()=>{
 const wrong=result({score:0,percentage:0,results:result().results.map(row=>({...row,isCorrect:false,unanswered:undefined}))});
 setup({saved:wrong});await screen.findByText('Database basics');fireEvent.click(screen.getByRole('radio',{name:'Wallpaper'}));fireEvent.click(screen.getByRole('button',{name:'Submit attempt'}));
 await screen.findByText('0/3');expect(screen.getAllByText('Incorrect',{exact:true})).toHaveLength(3);
 const first=screen.getByRole('heading',{name:'1. Which is a key?'}).closest('li');expect(within(first).getByText(/Your answer:/)).toHaveTextContent('Wallpaper');expect(within(first).getByText(/Correct answer:/)).toHaveTextContent('Primary key');
});
test('clear answer returns to unanswered and all blanks can be submitted',async()=>{
 const blank=result({score:0,percentage:0,results:result().results.map(row=>({...row,isCorrect:false,unanswered:true}))});const {sendAttempt}=setup({saved:blank});await screen.findByText('Database basics');
 fireEvent.click(screen.getByRole('radio',{name:'Primary key'}));fireEvent.click(screen.getByRole('button',{name:'Clear answer for question 1'}));expect(screen.getByRole('radio',{name:'Primary key'})).not.toBeChecked();fireEvent.click(screen.getByRole('button',{name:'Submit attempt'}));
 expect(await screen.findByText('0/3')).toBeInTheDocument();expect(sendAttempt.mock.calls[0][1]).toEqual([]);expect(screen.getAllByText('Unanswered',{exact:true})).toHaveLength(3);
});
test('freezes editable controls while pending and guards duplicate submit events',async()=>{
 let resolve;const {sendAttempt}=setup();sendAttempt.mockImplementation(()=>new Promise(r=>{resolve=r;}));await screen.findByText('Database basics');
 const button=screen.getByRole('button',{name:'Submit attempt'});fireEvent.click(button);fireEvent.submit(button.closest('form'));expect(sendAttempt).toHaveBeenCalledTimes(1);
 screen.getAllByRole('radio').forEach(r=>expect(r).toBeDisabled());expect(screen.getByRole('button',{name:'Submitting…'})).toBeDisabled();expect(screen.queryByText('Your results')).not.toBeInTheDocument();
 await act(async()=>resolve(result()));expect(await screen.findByText('2/3')).toBeInTheDocument();
});
test.each([401,403,404,400,500])('load failure %s has no form or false success and can retry',async status=>{
 const {loadQuiz}=setup({loadError:httpError(status)});expect(await screen.findByRole('alert')).toBeInTheDocument();expect(screen.queryByRole('radio')).not.toBeInTheDocument();
 loadQuiz.mockResolvedValue(quiz());fireEvent.click(screen.getByRole('button',{name:'Try loading again'}));expect(await screen.findByText('Database basics')).toBeInTheDocument();
});
test.each([401,403,404,400,500])('submission failure %s preserves answers and never renders results',async status=>{
 const {sendAttempt}=setup({sendError:httpError(status)});await screen.findByText('Database basics');fireEvent.click(screen.getByRole('radio',{name:'False'}));fireEvent.click(screen.getByRole('button',{name:'Submit attempt'}));
 await screen.findByRole('alert');expect(screen.queryByText('Your results')).not.toBeInTheDocument();expect(screen.getByRole('radio',{name:'False'})).toBeChecked();expect(sendAttempt).toHaveBeenCalledTimes(1);
});
test('409 blocks another submission rather than retrying silently',async()=>{
 const {sendAttempt}=setup({sendError:httpError(409)});await screen.findByText('Database basics');fireEvent.click(screen.getByRole('button',{name:'Submit attempt'}));await screen.findByRole('alert');expect(screen.getByRole('button',{name:'Submit attempt'})).toBeDisabled();expect(sendAttempt).toHaveBeenCalledTimes(1);
});
test('malformed success response is not presented as saved results',async()=>{
 setup({saved:{score:99}});await screen.findByText('Database basics');fireEvent.click(screen.getByRole('button',{name:'Submit attempt'}));expect(await screen.findByRole('alert')).toHaveTextContent('could not be confirmed');expect(screen.queryByText('Your results')).not.toBeInTheDocument();
});
test('retake refreshes the quiz and resets answers; no-retake hides retake action',async()=>{
 const {loadQuiz,unmount}=setup();await screen.findByText('Database basics');fireEvent.click(screen.getByRole('button',{name:'Submit attempt'}));await screen.findByText('2/3');fireEvent.click(screen.getByRole('button',{name:'Start another attempt'}));await screen.findByRole('button',{name:'Submit attempt'});expect(loadQuiz).toHaveBeenCalledTimes(2);expect(screen.getByText('0 of 3 answered. Blank answers receive 0 points.')).toBeInTheDocument();
 unmount();setup({data:quiz({allowRetake:false})});await screen.findByText('Database basics');fireEvent.click(screen.getByRole('button',{name:'Submit attempt'}));await screen.findByText('2/3');expect(screen.queryByRole('button',{name:'Start another attempt'})).not.toBeInTheDocument();expect(screen.getByText('This quiz does not allow another attempt.')).toBeInTheDocument();
});
test('changing quiz identity resets state and ignores an old pending submission',async()=>{
 let resolveOld;const loadQuiz=jest.fn().mockImplementation(async id=>quiz({id,title:id===quizId?'Quiz A':'Quiz B'}));const sendAttempt=jest.fn(()=>new Promise(r=>{resolveOld=r;}));
 const {rerender}=render(<AttemptPage quizId={quizId} loadQuiz={loadQuiz} sendAttempt={sendAttempt}/>);await screen.findByText('Quiz A');fireEvent.click(screen.getByRole('button',{name:'Submit attempt'}));const signal=sendAttempt.mock.calls[0][2].signal;
 rerender(<AttemptPage quizId={'cccccccccccccccccccccccc'} loadQuiz={loadQuiz} sendAttempt={sendAttempt}/>);await screen.findByText('Quiz B');await act(async()=>resolveOld(result()));expect(screen.queryByText('Your results')).not.toBeInTheDocument();expect(signal.aborted).toBe(true);expect(screen.getByText('Quiz B')).toBeInTheDocument();
});
test('ignores a loading response after unmount',async()=>{
 let resolve;const loadQuiz=jest.fn(()=>new Promise(r=>{resolve=r;}));const {unmount}=render(<AttemptPage quizId={quizId} loadQuiz={loadQuiz}/>);const signal=loadQuiz.mock.calls[0][1].signal;unmount();await act(async()=>resolve(quiz()));expect(signal.aborted).toBe(true);
});
