const winston = require("winston");
const zip = require("node-zip");
const fs = require("fs");
const path = require("path");

winston.add(winston.transports.File, { filename: "backup.log" });
winston.remove(winston.transports.Console);

const { exec } = require("child_process");
const path = require("path");
const nodemailer = require("nodemailer");

/**
 * Generates dump file name with the current time stamp
 * @param {String} project  project name
 * @param {String} db data base name
 * @param {Date} timestamp  time
 * @param {String} ext file name extension defaults to 'gzip'
 */
const buildFileName = (project, db, timestamp, ext = "gzip") => {
  const date = timestamp
    .toString()
    .substr(0, 15)
    .replace(/ /g, "-");
  const time = timestamp.toTimeString().substr(0, 8);
  return `${project}-${db}-${date}-${time}.${ext}`.toLowerCase();
};
/**
 * Generates subject
 * @param {String} project  project name
 * @param {String} db data base name
 * @param {Date} timestamp  time
 */
const buildSubject = (project, db, timestamp) => {
  const date = timestamp.toString().substr(0, 15);
  const time = timestamp.toTimeString().substr(0, 5);
  return `${project} ${db} ${date} ${time}`;
};

const backupDB = (project, db, basePath, timestamp, cb) => {
  winston.log("info", "dumping db ...");
  const fileName = buildFileName(project, db, timestamp);
  const zipFileName = `${fileName.slice(0, -4)}.zip`;
  const filePath = path.join(basePath, fileName);
  exec(`mongodump --db ${db} --gzip --archive=${filePath}`, () => {
    const zipper = zip();
    zipper.file(zipFileName, fs.readFileSync(path.join(__dirname, fileName)));
    const data = zipper.generate({ base64: false, compression: "DEFLATE" });
    fs.writeFileSync(zipFileName, data, "binary");
    cb(null, zipFileName);
  });
};
const emailSender = (data, cb) => {
  winston.log("info", "sending email ...");
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // secure:true for port 465, secure:false for port 587
    auth: {
      user: data.email,
      pass: data.password
    }
  });

  const attachments = [];

  const filePath = path.join(data.path, data.fileName);
  attachments[attachments.length] = { path: filePath };

  const mailOptions = {
    from: data.email,
    to: data.email, // list of receivers
    subject: data.subject, // Subject line
    html: "",
    attachments
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      winston.log("warn", error);
      return cb(error);
    }
    return cb(null, info);
  });
};
module.exports = {
  backup: (db, basePath, email, password, project) => {
    winston.log("info", "sending email ...");
    const timestamp = new Date();
    const subject = buildSubject(project, db, timestamp);
    backupDB(project, db, basePath, timestamp, (err, fileName) => {
      emailSender(
        {
          email,
          password,
          subject,
          fileName,
          path: basePath
        },
        () => {}
      );
    });
  }
};
