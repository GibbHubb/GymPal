// G16 — Program builder routes.
const express = require('express');
const {
    listPrograms,
    createProgram,
    getProgram,
    deleteProgram,
    upsertProgramDay,
    assignProgram,
    todayForClient,
} = require('../controllers/programsController');
const { authenticateToken } = require('../controllers/usersController');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/programs');

const router = express.Router();

// Today's session for the calling client — register before /:id so it
// isn't shadowed by the program-detail route.
router.get('/today', authenticateToken, todayForClient);

router.get('/', authenticateToken, listPrograms);
router.post('/', authenticateToken, validate(schemas.createProgram), createProgram);
router.get('/:id', authenticateToken, getProgram);
router.delete('/:id', authenticateToken, deleteProgram);

router.put('/:id/days', authenticateToken, validate(schemas.upsertProgramDay), upsertProgramDay);
router.post('/:id/assign', authenticateToken, validate(schemas.assignProgram), assignProgram);

module.exports = router;
