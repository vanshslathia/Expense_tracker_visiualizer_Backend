const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { authorizeRole } = require("../middleware/auth");
const {
    getAllUsers,
    getUserById,
    deleteUser,
    updateUserRole,
} = require("../controllers/userController");

router.use(auth, authorizeRole("admin"));

router.get("/users", getAllUsers);
router.get("/users/:id", getUserById);
router.delete("/users/:id", deleteUser);
router.put("/users/:id/role", updateUserRole);

module.exports = router;

