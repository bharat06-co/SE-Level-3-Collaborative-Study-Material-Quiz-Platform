import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppRoutes from '../src/AppRoutes';
jest.mock('../src/App',()=>function Home(){return <h1>Foundation home</h1>;});
jest.mock('../src/features/attempts/StudentAttemptPage',()=>function Page({quizId}){return <h1>Student attempt {quizId || 'entry'}</h1>;});
jest.mock('../src/features/quizzes/QuizAuthoringPage',()=>function QuizPage(){return <h1>Quiz authoring</h1>;});
test.each([['/','Foundation home'],['/attempt','Student attempt entry'],['/quizzes','Quiz authoring'],['/quizzes/aaaaaaaaaaaaaaaaaaaaaaaa/attempt','Student attempt aaaaaaaaaaaaaaaaaaaaaaaa'],['/not-a-page','Page not found']])('routes %s', (path,title)=>{render(<MemoryRouter initialEntries={[path]}><AppRoutes/></MemoryRouter>);expect(screen.getByRole('heading',{name:title})).toBeInTheDocument();});
