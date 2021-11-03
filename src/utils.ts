import _ from "lodash";


/*
 * Force having an array of not empty strings
 */
export const stringToNotEmptyArrayString = (value: string[] | string | undefined): string[] => {
  if (value && Array.isArray(value)) {
    return value.filter(v => v)
  } else if (value && _.isString(value) ) {
    return [value]
  } else {
    return []
  }
}

/*
 * A mix of lodash _.pick and _.get, thx stackoverflow people
 */
export const flatPick = (object: {}, paths: string[]) => {
  const o = {};

  paths.forEach(path => _.set(
    o,
    _.last(path.split('.'))!,
    _.get(object, path)
  ));

  return o;
}
