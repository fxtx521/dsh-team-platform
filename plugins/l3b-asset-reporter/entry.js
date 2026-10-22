/**
 * 稳定入口（砺 · 资产上报插件）
 * DSH 插件模块按 specifier 缓存：用稳定入口 + 时间戳 URL 重新导入实现，
 * 改 reporter.js 后只需 remove_bundle + install_bundle 即可生效。
 */
export function apply(ctx, config) {
  const url = new URL(`./reporter.js?v=${Date.now()}`, import.meta.url).href;
  return import(url).then((mod) => mod.apply(ctx, config));
}
