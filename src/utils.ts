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
