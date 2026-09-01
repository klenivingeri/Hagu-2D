export function getTiledProperty(properties, name) {
  if (Array.isArray(properties)) {
    return properties.find((property) => property.name === name)?.value;
  }

  return properties?.[name]?.value ?? properties?.[name];
}
