const { ObjectId, GridFSBucket } = require('mongodb')
const { Readable } = require('stream')
const { getDbReference } = require('../lib/mongo')

const PhotoSchema = {
  businessId: { required: true },
  caption: { required: false }
}

exports.PhotoSchema = PhotoSchema

function getPhotoBucket() {
  return new GridFSBucket(getDbReference(), { bucketName: 'photos' })
}

function getThumbBucket() {
  return new GridFSBucket(getDbReference(), { bucketName: 'thumbs' })
}

function getExtensionFromMimeType(mimetype) {
  if (mimetype === 'image/jpeg') {
    return 'jpg'
  } else if (mimetype === 'image/png') {
    return 'png'
  }
  return null
}

async function insertNewPhoto(photo, file) {
  const db = getDbReference()
  const bucket = getPhotoBucket()

  const businessId = new ObjectId(photo.businessId)
  const extension = getExtensionFromMimeType(file.mimetype)

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(file.originalname, {
      metadata: {
        businessId,
        caption: photo.caption || '',
        contentType: file.mimetype,
        extension
      }
    })

    Readable.from(file.buffer)
      .pipe(uploadStream)
      .on('error', reject)
      .on('finish', async () => {
        resolve(uploadStream.id)
      })
  })
}

exports.insertNewPhoto = insertNewPhoto

async function getPhotoById(id) {
  if (!ObjectId.isValid(id)) {
    return null
  }

  const db = getDbReference()
  const photo = await db.collection('photos.files').findOne({
    _id: new ObjectId(id)
  })

  if (!photo) {
    return null
  }

  const extension = photo.metadata.extension || 'jpg'

  const result = {
    _id: photo._id,
    businessId: photo.metadata.businessId,
    caption: photo.metadata.caption,
    contentType: photo.metadata.contentType,
    url: `/media/photos/${photo._id}.${extension}`
  }

  if (photo.metadata.thumbId) {
    result.thumbUrl = `/media/thumbs/${photo._id}.jpg`
  }

  return result
}

exports.getPhotoById = getPhotoById

async function getPhotosByBusinessId(businessId) {
  if (!ObjectId.isValid(businessId)) {
    return []
  }

  const db = getDbReference()
  const photos = await db.collection('photos.files')
    .find({ 'metadata.businessId': new ObjectId(businessId) })
    .toArray()

  return photos.map(photo => {
    const extension = photo.metadata.extension || 'jpg'

    const result = {
      _id: photo._id,
      businessId: photo.metadata.businessId,
      caption: photo.metadata.caption,
      contentType: photo.metadata.contentType,
      url: `/media/photos/${photo._id}.${extension}`
    }

    if (photo.metadata.thumbId) {
      result.thumbUrl = `/media/thumbs/${photo._id}.jpg`
    }

    return result
  })
}

exports.getPhotosByBusinessId = getPhotosByBusinessId

function getPhotoDownloadStreamById(id) {
  const bucket = getPhotoBucket()
  return bucket.openDownloadStream(new ObjectId(id))
}

exports.getPhotoDownloadStreamById = getPhotoDownloadStreamById

async function getPhotoFileById(id) {
  if (!ObjectId.isValid(id)) {
    return null
  }

  const db = getDbReference()
  return await db.collection('photos.files').findOne({
    _id: new ObjectId(id)
  })
}

exports.getPhotoFileById = getPhotoFileById

function getThumbDownloadStreamByOriginalPhotoId(id) {
  const bucket = getThumbBucket()

  return bucket.openDownloadStreamByName(`${id}.jpg`)
}

exports.getThumbDownloadStreamByOriginalPhotoId = getThumbDownloadStreamByOriginalPhotoId

async function saveThumbnailForPhoto(photoId, imageBuffer) {
  const db = getDbReference()
  const bucket = getThumbBucket()

  const thumbId = await new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(`${photoId}.jpg`, {
      contentType: 'image/jpeg',
      metadata: {
        originalPhotoId: new ObjectId(photoId),
        contentType: 'image/jpeg'
      }
    })

    Readable.from(imageBuffer)
      .pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => resolve(uploadStream.id))
  })

  await db.collection('photos.files').updateOne(
    { _id: new ObjectId(photoId) },
    { $set: { 'metadata.thumbId': thumbId } }
  )

  return thumbId
}

exports.saveThumbnailForPhoto = saveThumbnailForPhoto