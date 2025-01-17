const express = require("express");
var router = express.Router();
const mongoose = require("mongoose");
const diaClient = mongoose.model("diaClient");
const diaClientMap = require("../util/diaClientMapper");
const { getParameters } = require("../util/dialogClient");
const GetAccessToken = require("../util/accessToken");
const { default: axios } = require("axios");
let bimanCreateClient = process.env.BIMAN_BASE + process.env.BIMAN_C_CLIENT;
let bimanUpdateClient = process.env.BIMAN_BASE + process.env.BIMAN_U_CLIENT;

/**
 * @swagger
 *  /diaClient:
 *    post:
 *      description: Crea un cliente potencial en suiteCRM
 *    parameters:
 *      - name: clienteDialogFlow
 *        in: body
 *        description: Cliente proveniente de DialogFlow a suiteCRM
 *        required: true
 *        schema:
 *          type: object
 *          properties:
 *            Nombre:
 *              type: string
 *            Apellido:
 *              type: string
 *            Telefono:
 *              type: string
 *            Correo:
 *              type: string
 *            Ubicacion:
 *              type: string
 *            Motivo:
 *              type: string
 *    responses:
 *      '201':
 *        description: Cliente potencial insertado de manera satisfactoria en suiteCRM
 */

router.post("/", async (req, res) => {
  await insertRecord(req, res);
});

router.put("/update", (req, res) => {
  updateRecord(req, res);
});

async function insertRecord(req, res) {
  const { Nombre, Apellido, Telefono, Correo, Ubicacion, Motivo } =
    req.body.queryResult.parameters;
  console.log(req.body.queryResult.parameters)
  try {
    let client = new diaClient({
      firstName: Nombre,
      lastName: Apellido,
      displayName: `${Nombre} ${Apellido}`,
      phoneNumber: Telefono,
      email: Correo,
      motivo: Motivo
    });

    const token = await GetAccessToken();
    await axios.post(
      `${process.env.SUITE_CRM}/V8/module`,
      {
        data: {
          type: "Leads",
          attributes: {
            first_name: Nombre,
            last_name: Apellido,
            email1: Correo,
            phone_mobile: Telefono,
            primary_address_city: Ubicacion,
            description: Motivo
          },
        },
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    client.save(async (err, doc) => {
      if (!err) {
        res.json({ status: 200, message: doc });
      } else
        res.json({ status: 404, message: `Error en Inserción : ' + ${err}` });
    });
  } catch (error) {
    console.log(error);
  }
}

function updateRecord(req, res) {
  let params = getParameters(req.body);
  try {
    let client = diaClientMap(params);
    diaClient.findOneAndUpdate(
      { _id: client._id },
      client,
      { new: true },
      (err, doc) => {
        if (!err) {
          fetch(bimanUpdateClient, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            mode: "cors",
            body: JSON.stringify(doc),
          })
            .then((response) => {
              let data = response.data;
              console.log(data);
            })
            .catch((err) => {
              console.log(err);
            });
        } else
          res.json({
            status: 404,
            message: `No se actualizó el registro : ' + ${err}`,
          });
      }
    );
  } catch (error) {
    console.log(error);
  }
}

router.get("/list", (req, res) => {
  try {
    diaClient.find((err, docs) => {
      if (err)
        res.json({
          status: 404,
          message: `Error durante la recuperación de datos : ' + ${err}`,
        });
      res.json({ status: 200, objects: docs });
    });
  } catch (error) {
    console.log(error);
  }
});

router.get("/:id", (req, res) => {
  try {
    diaClient.find({ _id: req.params.id }, (err, doc) => {
      if (err)
        res.json({
          status: 404,
          message: `No se encontró el registro : ' + ${err}`,
        });
      res.json({ status: 200, object: doc });
    });
  } catch (error) {
    console.log(error);
  }
});

router.get("/delete/:id", (req, res) => {
  try {
    req.body.habilitado = false;
    diaClient.findOneAndUpdate(
      { _id: req.params.id },
      diaClientMap(req.body),
      (err, doc) => {
        if (!err)
          res.json({ status: 200, message: `Eliminación satisfactoria` });
        else
          res.json({
            status: 404,
            message: `No se eliminó el registro : ' + ${err}`,
          });
      }
    );
  } catch (error) {
    console.log(error);
  }
});

module.exports = router;
