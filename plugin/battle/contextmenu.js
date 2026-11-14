export function guardContextMenu(root) {
  // Bubble after local UI handlers; cancel only the browser's default menu.
  const onContextMenu = (event) => {
    const target = event.target;
    const element = typeof target?.closest === 'function' ? target : target?.parentElement;
    if (!element || element.isContentEditable || element.closest('input, textarea, [data-pkb-native-menu="allow"]')) return;
    event.preventDefault();
  };
  root.addEventListener('contextmenu', onContextMenu);
  return () => root.removeEventListener('contextmenu', onContextMenu);
}
