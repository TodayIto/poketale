export function refitScale(scale) {
  if (!scale?.canvas) return false;
  scale.getParentBounds();
  if (!(scale.parentSize.width > 0 && scale.parentSize.height > 0)) return false;
  scale.refresh();
  return true;
}
