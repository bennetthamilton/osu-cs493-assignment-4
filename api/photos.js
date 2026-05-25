const { Router } = require('express')
const multer = require('multer')

const {
  insertNewPhoto,
  getPhotoById
} = require('../models/photo')

const { sendPhotoProcessingTask } = require('../lib/rabbitmq')

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true)
    } else {
      cb(new Error('Only JPEG and PNG files are allowed'))
    }
  }
})

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send({
      error: 'Request must include an image file in the file field'
    })
  }

  if (!req.body.businessId) {
    return res.status(400).send({
      error: 'Request must include businessId'
    })
  }

  try {
    const id = await insertNewPhoto(req.body, req.file)

    await sendPhotoProcessingTask(id)

    res.status(201).send({
      id,
      links: {
        photo: `/photos/${id}`,
        business: `/businesses/${req.body.businessId}`
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).send({
      error: 'Error inserting photo into DB. Please try again later.'
    })
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const photo = await getPhotoById(req.params.id)

    if (photo) {
      res.status(200).send(photo)
    } else {
      next()
    }
  } catch (err) {
    console.error(err)
    res.status(500).send({
      error: 'Unable to fetch photo. Please try again later.'
    })
  }
})

module.exports = router