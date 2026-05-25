const amqp = require('amqplib')

const rabbitHost = process.env.RABBITMQ_HOST || 'localhost'
const rabbitUrl = `amqp://${rabbitHost}`
const queueName = process.env.RABBITMQ_QUEUE || 'photos'

let connection = null
let channel = null

async function getChannel() {
  if (channel) {
    return channel
  }

  connection = await amqp.connect(rabbitUrl)
  channel = await connection.createChannel()
  await channel.assertQueue(queueName, { durable: true })

  return channel
}

async function sendPhotoProcessingTask(photoId) {
  const ch = await getChannel()

  ch.sendToQueue(
    queueName,
    Buffer.from(JSON.stringify({ photoId: String(photoId) })),
    { persistent: true }
  )
}

exports.sendPhotoProcessingTask = sendPhotoProcessingTask
exports.getChannel = getChannel
exports.queueName = queueName