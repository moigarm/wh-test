require("dotenv").config();

const mongoose = require("mongoose");

const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;

const WooCommerce = new WooCommerceRestApi({
  url: process.env.WOOCOMMERCE_BASE_URL, // Your store URL
  consumerKey: process.env.CONSUMER_KEY, // Your consumer key
  consumerSecret: process.env.CONSUMER_SECRET, // Your consumer secret
  version: "wc/v3", // WooCommerce WP REST API version
});

function getWooStatus() {
  let res = {};
  WooCommerce.get("system_status")
    .then((response) => {
      res = response.data;
      console.log("No error");
    })
    .catch((error) => {
      console.log(error.response.data);
    });
  return res;
}

async function crearWooProducto(obj) {
  let res1 = {};
  try {
    console.log("Crear producto 1");
    let datos = await WooCommerce.post("products", obj);
    console.log("Producto creado?");
    res1 = datos.data;
    console.log(res1);
  } catch (error) {
    //console.log(error);
    console.log("EFE creando producto");
  }
  return res1;
}

async function actualizarWooProducto(id, obj) {
  let res1 = {};
  delete obj["sku"]
  try {
    let datos = await WooCommerce.put(`products/${id}`, obj);
    res1 = datos.data;
  } catch (error) {
    console.log(error);
  }
  return res1;
}

async function WooProductoBatch(objs) {
  let res1 = [];
  try {
    await Promise.all(
      objs.map(async (element, i) => {
        res1[i] = await crearWooProducto(element);
      })
    );
    console.log("Did it finish?");
  } catch (error) {
    console.log("Error on batch");
    //console.log(error);
  }
  return res1;
}

async function WooProductoBatchCreate(objs, variableSize) {
  let response = [];
  console.log(objs?.length);
  if(variableSize > 99) variableSize = 100
  try {
    for (
      let increment = 0;
      increment < objs?.length;
      increment += variableSize
    ) {
      let temp = {
        create: objs.slice(increment, increment + variableSize),
        update: [],
        delete: [],
      };
      let data = await WooCommerce.post("products/batch", temp);
      //console.log("data?.data")
      //console.log(data?.data.create[0])
      response.push(data?.data)
      console.log("round: " + increment / variableSize);
    }
  } catch (error) {
    console.log("Error on batch");
    console.log(error);
  }
  return response;
}

function getCategoriesList(categories) {
  console.log(categories.length)
  return categories.map((prod) => prod.nomTipo)
  .filter((value, index, self) => self.indexOf(value) === index);
}

async function setCategoriesBatch(data) {
  const categories = getCategoriesList(data);
  console.log(categories);

  const woores = await WooCommerce.post("products/categories/batch", {
    create: categories.map((cat, index) => {
      return {
        name: cat,
        id: index,
      };
    }),
  });

  return woores.data.create;
}

async function setCategoriesFinal(categories){
  const woores = await WooCommerce.post("products/categories/batch", {
    create: categories
  });

  return woores.data.create;
}

async function createCategory(categoryName){
  const woores = await WooCommerce.post("products/categories", {
    name: categoryName
  })
  return woores.data
}

async function getWooProductoBySku(sku){
  // busacar por sku para agarrar el id de WooCommerce y así actualizar el producto en el ecommerce
  let res = await WooCommerce.get("products?filter[sku]='"+sku+"'")
  console.log(res.json())
  return res.json()
}
module.exports = {
  crearWooProducto,
  actualizarWooProducto,
  WooProductoBatch,
  getWooStatus,
  WooProductoBatchCreate,
  setCategoriesBatch,
  getWooProductoBySku,
  getCategoriesList,
  setCategoriesFinal,
  createCategory
};
