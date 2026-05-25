const { ObjectId } = require('mongodb')

const { getDbReference } = require('../lib/mongo')
const { extractValidFields } = require('../lib/validation')
const { getPhotosByBusinessId } = require('./photo')

const BusinessSchema = {
  name: { required: true },
  address: { required: true },
  city: { required: true },
  state: { required: true },
  zip: { required: true },
  category: { required: true },
  subcategory: { required: true },
  website: { required: false },
  email: { required: false }
}
exports.BusinessSchema = BusinessSchema

async function getBusinessesPage(page) {
  const db = getDbReference()
  const collection = db.collection('businesses')
  const count = await collection.countDocuments()

  const pageSize = 10
  const lastPage = Math.ceil(count / pageSize)
  page = page > lastPage ? lastPage : page
  page = page < 1 ? 1 : page
  const offset = (page - 1) * pageSize

  const results = await collection.find({})
    .sort({ _id: 1 })
    .skip(offset)
    .limit(pageSize)
    .toArray()

  return {
    businesses: results,
    page: page,
    totalPages: lastPage,
    pageSize: pageSize,
    count: count
  }
}
exports.getBusinessesPage = getBusinessesPage

async function insertNewBusiness(business) {
  business = extractValidFields(business, BusinessSchema)
  const db = getDbReference()
  const collection = db.collection('businesses')
  const result = await collection.insertOne(business)
  return result.insertedId
}
exports.insertNewBusiness = insertNewBusiness

async function getBusinessById(id) {
  const db = getDbReference()
  const collection = db.collection('businesses')

  if (!ObjectId.isValid(id)) {
    return null
  }

  const business = await collection.findOne({
    _id: new ObjectId(id)
  })

  if (!business) {
    return null
  }

  business.photos = await getPhotosByBusinessId(id)

  return business
}

exports.getBusinessById = getBusinessById

async function bulkInsertNewBusinesses(businesses) {
  const businessesToInsert = businesses.map(function (business) {
    return extractValidFields(business, BusinessSchema)
  })
  const db = getDbReference()
  const collection = db.collection('businesses')
  const result = await collection.insertMany(businessesToInsert)
  return result.insertedIds
}
exports.bulkInsertNewBusinesses = bulkInsertNewBusinesses
