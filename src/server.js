require("dotenv").config();
require("./models/db");

const express = require("express");
const path = require("path");
const bodyparser = require("body-parser");
const cors = require("cors");

const diaClientController = require("./controllers/diaClientController");
const wooClientController = require("./controllers/wooClientController");
const wooProductoController = require("./controllers/wooProductoController");

//Endpoint for testing purposes
const dialogFlowController = require("./controllers/dialogFlowController");

const { batchInicial } = require("./util/batchInicial");
const {
  WooProductoBatchCreate,
  actualizarWooProducto,
  setCategoriesFinal,
  getCategoriesList,
} = require("./util/WooCommerceAPI");

const getCoolecheraProducts = require("./util/getCoolecheraProducts");
var cron = require("node-cron");
const mongoose = require("mongoose");
const wooProducto = mongoose.model("wooProducto");
const bimanProducto = mongoose.model("BimanProducto");
const categoriesModel = mongoose.model("categories");
const bimanCategoriesModel = mongoose.model("bimanCategories");
const {
  bimanProductoToWooNoId,
  MapCategoriesToProds,
  bimanProductoToWooBatchNoID,
} = require("./util/wooProductoMapper");

let allowedOrigins = [""];

cron.schedule("*/30 * * * * *", async () => {
  let pruebaNuevoObjeto = {
    nombreAlmacen: "PS Tienda Virtual NUEVO",
    ID: 55555,
    CodigoSap: "9999",
    NombreComercial: "IMPUESTO BOLSA NUEVO",
    nomGenerico: "Bolsa",
    VentaUnitaria: 1110,
    tasaIva: 0,
    existencia: 150,
    nomTipo: "NUEVA CATEGORIA",
    Idservicio: 25,
    tasaDescuento: 0,
    Cantidad: 0,
  };

  console.log("HEY TEST");
  console.log(await wooProducto.findOne({ sku: "3768" }));
  console.log("paso 1");

  const bimanProds = await bimanProducto.find({}, { _id: 0, __v: 0 });
  let coolecheraProds = await getCoolecheraProducts();
  // coolecheraProds.push(pruebaNuevoObjeto)
  // coolecheraProds[coolecheraProds.length - 1].VentaUnitaria = 123456
  //setCategoriesBatch
  const bimanCategories = await bimanCategoriesModel.find(
    {},
    { _id: 0, __v: 0 }
  );
  let coolecheraCatTemp = getCategoriesList(coolecheraProds);
  let coolecheraCategories = [];
  coolecheraCatTemp.forEach((ele) => {
    coolecheraCategories.push({ name: ele });
  });
  if (bimanCategories.length === 0) {
    await bimanCategoriesModel.insertMany(coolecheraCategories);
  }

  if (bimanProds.length === 0) {
    await bimanProducto.insertMany(coolecheraProds);
  }

  if (JSON.stringify(bimanProds) !== JSON.stringify(coolecheraProds)) {
    await bimanProducto.deleteMany({});
    await bimanProducto.insertMany(coolecheraProds);
  }

  if (
    JSON.stringify(bimanCategories) !== JSON.stringify(coolecheraCategories)
  ) {
    await bimanCategoriesModel.deleteMany({});
    await bimanCategoriesModel.insertMany(coolecheraCategories);
  }

  let bimanProdsNew = await bimanProducto.find({}, { _id: 0, __v: 0 });
  let bimanCategoriesNew = await bimanCategoriesModel.find(
    {},
    { _id: 0, __v: 0 }
  );

  let updates = [];
  let news = [];
  console.log("paso 2");
  const validateBimanProd = (objActual, bimanProd) => {
    return (
      objActual.NombreComercial === bimanProd.NombreComercial &&
      objActual.nomGenerico === bimanProd.nomGenerico &&
      objActual.VentaUnitaria === bimanProd.VentaUnitaria &&
      objActual.Cantidad === bimanProd.Cantidad
    );
  };

  const validateBimanCategory = (objActual, bimanProdCategory) => {
    return objActual.name === bimanProdCategory.name;
  };

  newCategories = [];
  console.log("paso 2.1");
  // console.log(bimanCategoriesNew)
  // console.log(bimanCategories)

  if (bimanCategories.length > 0) {
    bimanCategoriesNew.forEach((prod, index) => {
      if (!(index <= bimanCategories.length - 1)) {
        if (validateBimanCategory(prod, bimanCategories[index])) {
          newCategories.push(prod);
        }
      }
    });
  } else {
    bimanCategoriesNew.forEach((prod) => {
      newCategories.push(prod);
    });
  }
  console.log("CATEGORIES");
  console.log(newCategories);

  bimanProdsNew.forEach((prod, index) => {
    if (index <= bimanProds.length - 1) {
      if (!validateBimanProd(prod, bimanProds[index])) {
        updates.push(bimanProductoToWooNoId(prod));
      }
    } else {
      news.push(prod);
    }
  });
  if (newCategories.length > 0) {
    let categoriesInWooCommerce = await setCategoriesFinal(newCategories);
    await categoriesModel.insertMany(categoriesInWooCommerce);
    console.log(categoriesInWooCommerce);
  }

  let WooCommerceProductCategories = await categoriesModel.find(
    {},
    { _id: 0, __v: 0 }
  );
  let wooProductsUpdates = [];
  console.log("Objetos a insertar");
  console.log(news.length);
  console.log("Updates length");
  console.log(updates.length);
  for (let i = 0; i < updates.length; i++) {
    try {
      const newProd = await wooProducto.find(
        { sku: updates[i].sku },
        { _id: 0, __: 0 }
      );
      let newObj = updates[i];
      newObj.id = newProd[0].id;
      let categories = WooCommerceProductCategories.find(
        (obj) => obj.name === newObj.categories
      );
      newObj.categories = categories;
      wooProductsUpdates.push(newObj);
    } catch (e) {
      console.log(e);
    }
  }

  // return 0
  console.log("paso 3");
  if (wooProductsUpdates.length !== 0 || news.length !== 0) {
    try {
      let toCreate = [];
      //console.log(news[0])
      if (news.length !== 0) {
        let tempProds = bimanProductoToWooBatchNoID(news);
        toCreate = MapCategoriesToProds(
          tempProds,
          WooCommerceProductCategories
        );
        console.log(toCreate[0]);
      }

      if (news.length > 0) {
        let createsWoo = await WooProductoBatchCreate(toCreate, 50);
        console.log("Crear productos");
        createsWoo.forEach((ele) => {
          wooProducto.insertMany(ele.create, (err, docs) => {
            if (err) console.log(err);
          });
        });
      }

      if (wooProductsUpdates.length > 0) {
        wooProductsUpdates.forEach(async (element) => {
          let res = await actualizarWooProducto(element.id, element);
          /*  console.log("Objeto actualizado");
          console.log(res); */
        });
        console.log("Actualizar producto en WooCommerce");
        wooProductsUpdates.forEach((element) => {
          wooProducto.findOneAndUpdate({ id: element.id }, element);
        });
      }
    } catch (e) {
      console.log(e);
    }
  }
  console.log("finalizado");
});

var app = express();
app.use(
  cors({
    origin: function (origin, callback) {
      // permite requests sin origen como los curl requests
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        let msg =
          "La política CORS para esta API, no permite el acceso " +
          "desde este origen especificado.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
  })
);

app.use(
  bodyparser.urlencoded({
    extended: true,
  })
);
app.use(bodyparser.json());

app.listen(process.env.PORT, () => {
  console.log(`Servidor Express inció en puerto : ${process.env.PORT}`);
});

app.use("/diaClient", diaClientController);
app.use("/wooClient", wooClientController);
app.use("/wooProducto", wooProductoController);
app.use("/dialogFlow", dialogFlowController);
