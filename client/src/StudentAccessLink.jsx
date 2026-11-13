import { getCurrentUser } from './authApi.js';

export function validExternalDestination(value) {
  try {
    const destination = new URL(value);
    return ['http:', 'https:'].includes(destination.protocol) && !destination.username && !destination.password
      ? destination.href
      : '';
  } catch {
    return '';
  }
}

export default function StudentAccessLink({ href, children, ...props }) {
  const destination = validExternalDestination(href);
  if (!destination) return <span className="tag">Official link not available</span>;

  const loginUrl = `/student?returnTo=${encodeURIComponent(destination)}`;
  const followLink = async event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const destinationWindow = window.open('about:blank', '_blank');
    if (destinationWindow) destinationWindow.opener = null;
    try {
      const account = await getCurrentUser();
      if (account.user?.role === 'student') {
        if (destinationWindow) destinationWindow.location.replace(destination);
        else window.location.assign(destination);
        return;
      }
    } catch {
      // Direct access is denied unless the student session can be confirmed.
    }
    destinationWindow?.close();
    window.location.assign(loginUrl);
  };

  return <a href={loginUrl} onClick={followLink} {...props}>{children}</a>;
}
