const sharp = require('sharp')
const { ObjectId } = require('mongodb')

const { connectToDb, getDbReference } = require('../lib/mongo')
const { getChannel, queueName } = require('../lib/rabbitmq')
const { saveThumbnailForPhoto } = require('../models/photo')

async function getOriginalPhotoBuffer(photoId) {
  const db = getDbReference()
  const bucket = new (require('mongodb').GridFSBucket)(db, {
    bucketName: 'photos'
  })

  return new Promise((resolve, reject) => {
    const chunks = []

    bucket.openDownloadStream(new ObjectId(photoId))
      .on('data', chunk => chunks.push(chunk))
      .on('error', reject)
      .on('end', () => resolve(Buffer.concat(chunks)))
  })
}

connectToDb(async () => {
  console.log('== Thumbnail worker connected to MongoDB')

  const channel = await getChannel()

  console.log(`== Thumbnail worker waiting for messages on queue "${queueName}"`)

  channel.consume(queueName, async msg => {
    if (!msg) {
      return
    }

    try {
      const task = JSON.parse(msg.content.toString())
      const photoId = task.photoId

      console.log('== Processing thumbnail for photo:', photoId)

      const originalBuffer = await getOriginalPhotoBuffer(photoId)

      const thumbnailBuffer = await sharp(originalBuffer)
        .resize(100, 100, {
          fit: 'cover'
        })
        .jpeg()
        .toBuffer()

      await saveThumbnailForPhoto(photoId, thumbnailBuffer)

      channel.ack(msg)

      console.log('== Finished thumbnail for photo:', photoId)
    } catch (err) {
      console.error('== Error processing thumbnail:', err)
      channel.nack(msg, false, false)
    }
  })
})