const mongoose = require("mongoose");
const requireLogin = require("../middlewares/requireLogin");

const Blog = mongoose.model("Blog");

module.exports = (app) => {
  app.get("/api/blogs/:id", requireLogin, async (req, res) => {
    const blog = await Blog.findOne({
      _user: req.user.id,
      _id: req.params.id,
    });

    res.send(blog);
  });

  app.get("/api/blogs", requireLogin, async (req, res) => {
    const redis = require("redis");
    const redisUrl = "redis://127.0.0.1:6379";
    const client = redis.createClient(redisUrl);

    // Default node package
    // Use promisify to convert callback to promise
    const util = require("util");

    client.get = util.promisify(client.get);

    // Check if we have cached data related to this query
    const cachedBlogs = await client.get(req.user.id);

    if (cachedBlogs) {
      console.log("Serving from cache");
      return res.send(JSON.parse(cachedBlogs));
    }

    // No cached data, continue to check mongodb
    const blogs = await Blog.find({ _user: req.user.id });

    console.log("Serving from mongodb");
    res.send(blogs);

    // Set redis cache
    client.set(req.user.id, JSON.stringify(blogs));
  });

  app.post("/api/blogs", requireLogin, async (req, res) => {
    const { title, content } = req.body;

    const blog = new Blog({
      title,
      content,
      _user: req.user.id,
    });

    try {
      await blog.save();
      res.send(blog);
    } catch (err) {
      res.send(400, err);
    }
  });
};
