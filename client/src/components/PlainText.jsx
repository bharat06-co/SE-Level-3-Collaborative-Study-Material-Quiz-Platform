// Values are React text children, not HTML. No markup interpretation or links.
export default function PlainText({ value }) {
  return <span>{typeof value === 'string' ? value : ''}</span>;
}
