const express = require("express");
var router = express.Router();
const mongoose = require("mongoose");
const { filterObject, ObjCompare } = require("../util/utils");
const wooProducto = mongoose.model("wooProducto");
const { wooProductoMap } = require("../util/wooProductoMapper");
const { crearWooProducto, actualizarWooProducto} = require("../util/WooCommerceAPI")
const { comesFromBiman_Woo } = require("../util/locations")
const fetch = require("node-fetch")
// BIMAN_C para Biman Create, BIMAN_U para Biman Update
let bimanCreateProduct = process.env.BIMAN_BASE + process.env.BIMAN_C_PRODUCT
let bimanUpdateProduct = process.env.BIMAN_BASE + process.env.BIMAN_U_PRODUCT

router.post("/", (req, res) => {
  console.log(req.body);
  insertRecord(req, res);
});

router.put("/update", (req, res) => {
  updateRecord(req, res);
});

function insertRecord(req, res) {
  let noNew = false
  try {
    producto.find({id: req.body.id}, (err, doc)=>{
      if(doc.id == req.body.id) noNew = true
    })
    if(!noNew){
    let producto = wooProductoMap(req.body);
    producto.save((err, doc) => {
      if (!err){
        if(comesFromBiman_Woo(req.header('x-wc-webhook-source')) == "biman"){
        fetch(bimanCreateProduct, {
          method: 'POST',
          headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
          },
          mode: 'cors',
          body: JSON.stringify(doc)
          }).then((response)=>{
              let data = response.data
              console.log(data)
          });
        }else{
          console.log("Crear producto en WooCommerce")
          crearWooProducto(doc)
        }
        res.json({status: 200, message: doc})
      }
      else res.json({ status: 404, message: `Error en Inserción : ' + ${err}` });
    });
  }
  } catch (error) {
    console.log(error)
  }
}

function updateRecord(req, res) {
  let recentlyUpdated = false
  console.log(filterObject(req.body, ["permalink"]));
  producto.find({id: req.body.id}, (err, doc)=>{
    // Último parámetro es para propiedades que no necesitan compararse
    // ejemplo: date_created, date_created_gmt, date_modified, date_modified_gmt
    // por que se quiere comparar si en realidad las propiedades fueron modificadas
    recentlyUpdated = ObjCompare(wooProductoMap(req.body), doc, ["date_modified", "date_modified_gmt"])
  })
  // Si no se acaban de actualizar
  if(!recentlyUpdated){
  try {
    wooProducto.findOneAndUpdate(
      { id: req.body.id },
      wooProductoMap(req.body),
      { new: true },
      (err, doc) => {
        if (!err){
          if(comesFromBiman_Woo(req.header('x-wc-webhook-source')) == "biman"){
            fetch(bimanUpdateProduct+"/"+id.req.body.id, {
              method: 'PUT',
              headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json'
              },
              mode: 'cors',
              body: JSON.stringify(doc)
              }).then((response)=>{
                  let data = response.data
                  console.log(data)
              });
            }else{
              console.log("Actualizando producto en WooCommerce")
              actualizarWooProducto(doc)
            }
        }
        else
        res.json({
          status: 404,
          message: `No se actualizó el registro : ' + ${err}`,
        });
      }
  );
    } catch (error) {
      console.log(error)
    }
  }
}

router.get("/list", (req, res) => {
  try {
    
    wooProducto.find((err, docs) => {
      if (err)
      res.json({
        status: 404,
        message: `Error durante la recuperación de datos : ' + ${err}`,
      });
      res.json({ status: 200, objects: docs });
    });
  } catch (error) {
    console.log(error)
  }
});

router.get("/:id", (req, res) => {
  try {
    
    wooProducto.find({ id: req.params.id }, (err, doc) => {
      if (err)
      res.json({
        status: 404,
        message: `No se encontró el registro : ' + ${err}`,
      });
      res.json({ status: 200, object: doc });
    });
  } catch (error) {
    console.log(error)
  }
});

router.get("/delete/:id", (req, res) => {
  try {
    
    req.body.habilitado = false;
    wooProducto.findOneAndUpdate(
      { id: req.params.id },
      wooProductoMap(req.body, false),
      (err, doc) => {
        if (!err) res.json({ status: 200, message: `Eliminación satisfactoria` });
        else
        res.json({
          status: 404,
          message: `No se eliminó el registro : ' + ${err}`,
        });
      }
      );
    } catch (error) {
      console.log(error)
    }
});

module.exports = router;
