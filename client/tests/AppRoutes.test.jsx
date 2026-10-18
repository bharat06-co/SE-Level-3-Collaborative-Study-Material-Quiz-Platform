import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppRoutes from '../src/AppRoutes';
jest.mock('../src/App',()=>function Home(){return <h1>Foundation home</h1>;});
jest.mock('../src/features/attempts/AttemptPage',()=>function Page({quizId}){return <h1>Attempt {quizId}</h1>;});
test.each([['/','Foundation home'],['/quizzes/aaaaaaaaaaaaaaaaaaaaaaaa/attempt','Attempt aaaaaaaaaaaaaaaaaaaaaaaa'],['/not-a-page','Page not found']])('routes %s', (path,title)=>{render(<MemoryRouter initialEntries={[path]}><AppRoutes/></MemoryRouter>);expect(screen.getByRole('heading',{name:title})).toBeInTheDocument();});
