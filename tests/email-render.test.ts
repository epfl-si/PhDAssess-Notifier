import 'mocha'
import Mustache from 'mustache'

const chai = require('chai')
chai.use(require('chai-fs'))
const expect = chai.expect

describe('notification tests', () => {
  it('should render the message', async () => {
    // 1. ARRANGE
    const message = `Dear Mr./Ms.\n` +
      `As part of your doctoral student {{ studentName }}’s annual report, ` +
      `please review the information provided, via the following link: {{ &link }}`

    const data = {
      studentName: 'John Smith',
      link: `<a href="https://www.epfl.ch">link</a>`
    }

    // 2. ACT
    const output = Mustache.render(message, data);

    // 3. ASSERT
    expect(output).to.not.be.empty
    expect(output).to.have.string(data.studentName)

    // don't escape link
    expect(output).to.not.have.string("&lt;a")
    // assert link is ok
    expect(output).to.have.string(data.link)
  })
})
