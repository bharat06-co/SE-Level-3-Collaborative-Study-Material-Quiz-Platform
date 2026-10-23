import { render, screen } from '@testing-library/react';
import PlainText from '../src/components/PlainText';
const payloads = [
  '<script>window.__xss = true</script>',
  '<img src=x onerror="window.__xss=true">',
  '<svg onload="window.__xss=true"></svg>',
  '<a href="javascript:alert(1)">click</a>',
  '&lt;script&gt;alert(1)&lt;/script&gt;',
];
test.each(payloads)('renders untrusted content only as text: %s', value => {
  const { container } = render(<PlainText value={value} />);
  expect(container.textContent).toBe(value);
  expect(container.querySelector('script,img,svg,a,iframe')).toBeNull();
  expect(window.__xss).toBeUndefined();
});
test('handles missing or non-string values without interpreting objects', () => {
  const { rerender, container } = render(<PlainText />);
  expect(container.textContent).toBe('');
  rerender(<PlainText value={{ __html: '<script>x</script>' }} />);
  expect(container.textContent).toBe('');
  rerender(<PlainText value="Normal text & punctuation" />);
  expect(screen.getByText('Normal text & punctuation')).toBeInTheDocument();
});
