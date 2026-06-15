import { createPortal } from 'react-dom';

// Renders children into document.body, escaping any ancestor that has a
// `transform` or `filter` (e.g. the page-transition motion.div in App.jsx).
// Such ancestors become the containing block for `position: fixed` descendants,
// which is exactly why the floating + button and modals previously scrolled
// with the page instead of anchoring to the viewport.
export default function Portal({ children }) {
  return createPortal(children, document.body);
}
