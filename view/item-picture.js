/** The texture key of a PokeAPI item picture (loadItemPicture) */
export const itemPictureKey = url => `item-pic:${url}`;

export function loadItemPicture(scene, url) {
  const key = itemPictureKey(url);
  if (scene.textures.exists(key)) return Promise.resolve(key);
  const loading = scene.itemPictures ??= new Map();
  if (!loading.has(url)) {
    loading.set(url, scene.assets.loadImage(url).then(img => {
      scene.life.check();
      if (!scene.textures.exists(key)) scene.textures.addImage(key, img);
      return key;
    }).catch(() => null));
  }
  return loading.get(url);
}
