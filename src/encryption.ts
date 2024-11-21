import debug_ from "debug";

const CryptoJS = require("crypto-js");
const debug = debug_('encryption')
import {Job} from "zeebe-node"
import {PhDAssessVariables} from "phd-assess-meta/types/variables";


export function encrypt(message: string | null, passphrase: string | undefined = process.env.PHDASSESS_ENCRYPTION_KEY): string | null {
  if (
    process.env.PHDASSESS_SKIP_ENCRYPTION &&
    process.env.PHDASSESS_SKIP_ENCRYPTION === 'true'
  ) return message

  if (passphrase === undefined) {
    throw 'encryption error, trying to encrypt a value without a passphrase set'
  }

  if (message === "" || message == null) {
    return message;
  } else {
    return CryptoJS.AES.encrypt(JSON.stringify(message), passphrase).toString();
  }
}

export function decrypt(cryptedMessage: string | null, passphrase: string | undefined = process.env.PHDASSESS_ENCRYPTION_KEY): string | null {
  if (
    process.env.PHDASSESS_SKIP_ENCRYPTION &&
    process.env.PHDASSESS_SKIP_ENCRYPTION === 'true'
  ) return cryptedMessage

  if (passphrase === undefined) {
    throw 'encryption error, Trying to encrypt a value without a passphrase set'
  }
  if (cryptedMessage === "" || cryptedMessage == null) {
    return cryptedMessage;
  } else {
    const bytes = CryptoJS.AES.decrypt(cryptedMessage, passphrase)
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8))
  }
}

export function decryptVariables(job: Job, ignoreKeys: string[] = []): PhDAssessVariables {
  const decryptedVariables:
    {
      [ key: string ]:
        string |
        null |
        ( string | null )[]
    } = {}

  Object.keys(job.variables).map((key) => {
    if (ignoreKeys.includes(key)) {
      decryptedVariables[key] = job.variables[key]
    } else {
      try {
        if (Array.isArray(job.variables[key])) {
          decryptedVariables[key] = job.variables[key].reduce((acc: ( string | null )[], item: string | null) => {
            const decryptedItem = decrypt(item)
            if (decryptedItem !== null) acc.push(decryptedItem)
            return acc
          }, [])
        } else {
          decryptedVariables[key] = decrypt(job.variables[key])
        }
      } catch (e: any) {
        if (e instanceof SyntaxError) {
          // not good, some values are not readable. Get the error for now,
          // but raise it after the whole decrypt
          // we may need to do something afterward
          debug(`Can't decrypt the key: ${ key }`)
        } else {
          console.error(`Error on key: ${ key }. Error: ${ e.message }`)
          throw e
        }
      }
    }
  })
  return decryptedVariables as unknown as PhDAssessVariables
}
