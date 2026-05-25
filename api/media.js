const { Router } = require('express')

const {
  getPhotoFileById,
  getPhotoDownloadStreamById,
  getThumbDownloadStreamByOriginalPhotoId
} = require('../models/photo')

const router = Router()

router.get('/photos/:filename', async (req, res, next) => {
  const filename = req.params.filename
  const id = filename.split('.')[0]

  try {
    const photo = await getPhotoFileById(id)

    if (!photo) {
      return next()
    }

    res.status(200)
    res.set('Content-Type', photo.metadata.contentType)

    const downloadStream = getPhotoDownloadStreamById(id)

    downloadStream.on('error', next)
    downloadStream.pipe(res)
  } catch (err) {
    console.error(err)
    res.status(500).send({
      error: 'Unable to download photo.'
    })
  }
})

router.get('/thumbs/:filename', async (req, res, next) => {
  const filename = req.params.filename
  const id = filename.split('.')[0]

  try {
    res.status(200)
    res.set('Content-Type', 'image/jpeg')

    const downloadStream = getThumbDownloadStreamByOriginalPhotoId(id)

    downloadStream.on('error', next)
    downloadStream.pipe(res)
  } catch (err) {
    console.error(err)
    res.status(500).send({
      error: 'Unable to download thumbnail.'
    })
  }
})

module.exports = router