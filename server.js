const express = require('express');
const uuid = require('uuid');
const multer = require('multer');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const ffmpeg = require('fluent-ffmpeg');

// Créer la connexion à la base de données SQLite



const app = express();
const port = 3000;

app.use((req, res, next) => {
  if (req.url === '/') {
    res.redirect('/index');
  } else {
    next();
  }
});

const videosDB = new sqlite3.Database('./videos.db');
const verticalVideosDB = new sqlite3.Database('./verticalVideos.db');
const usersDB = new sqlite3.Database("./users.db")

videosDB.run(`
  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    path TEXT,
    duration TEXT,
    image TEXT,
    format TEXT
  )
`);


verticalVideosDB.run(`
  CREATE TABLE IF NOT EXISTS videos (
    id STRING PRIMARY KEY,
    title TEXT,
    path TEXT,
    duration TEXT,
    image TEXT,
    format TEXT
  )
`);

usersDB.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    password TEXT,
    email TEXT,
    subscriptions TEXT,
    likedVideos TEXT,
    likedTags TEXT,
    uploadedVideos TEXT,
    accountStatus TEXT
  )
`);

app.get('/users/:id', (req, res) => {
  const sql = 'SELECT * FROM users WHERE id = ?';
  usersDB.get(sql, [videoId], (err, row) => {
    if (err) {
      console.error(err);
      res.status(500).json({ success: false, error: 'Erreur lors de la récupération des informations du compte.' });
    } else if (row) {
      // Retournez les informations de la vidéo au format JSON
      res.json({ success: true, video: row });
    } else {
      // Aucune vidéo trouvée avec cet identifiant
      res.status(404).json({ success: false, error: 'Aucun compte trouvé avec cet identifiant.' });
    }
  });
});

// Route pour récupérer les informations d'une vidéo par son identifiant
app.get('/videos/:id', (req, res) => {
  const videoId = req.params.id;

  // Exécutez une requête SQL pour obtenir les informations de la vidéo depuis la base de données
  const sql = 'SELECT * FROM videos WHERE id = ?';
  videosDB.get(sql, [videoId], (err, row) => {
    if (err) {
      console.error(err);
      res.status(500).json({ success: false, error: 'Erreur lors de la récupération des informations de la vidéo.' });
    } else if (row) {
      // Retournez les informations de la vidéo au format JSON
      res.json({ success: true, video: row });
    } else {
      // Aucune vidéo trouvée avec cet identifiant
      res.status(404).json({ success: false, error: 'Aucune vidéo trouvée avec cet identifiant.' });
    }
  });
});


app.get('/verticalVideos/:id', (req, res) => {
    const videoId = req.params.id;
    verticalVideosDB.get('SELECT * FROM videos WHERE id = ?', [videoId], (err, row) => {
      if (err) {
        res.status(500).json({ success: false, error: 'Erreur lors de la récupération des informations de la vidéo.' });
      } else if (row) {
        res.json({ success: true, video: row });
      } else {
        res.status(404).json({ success: false, error: 'Aucune vidéo trouvée avec cet identifiant.' });
      }
    });
  });
  

// Servir des fichiers statiques depuis le dossier 'uploads'
app.use('/uploads', express.static('uploads'));

// Servir des fichiers statiques depuis le dossier 'public'
app.use('/public', express.static('public'));

// Route pour la racine
app.get('/', (req, res) => {
  res.send('Bienvenue sur la page d\'accueil !');
});

// Route pour servir index.html
app.get('/index', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/watch', (req, res) => {
  res.sendFile(path.join(__dirname, 'watch.html'));
});
// Route pour servir upload.html
app.get('/upload', (req, res) => {
  res.sendFile(path.join(__dirname, 'upload.html'));
});
app.get('/account', (req, res) => {
  res.sendFile(path.join(__dirname, 'account.html'));
});
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});
// Servir des fichiers statiques depuis le dossier 'public'
app.use('/public', express.static('public'));

// Servir des fichiers statiques depuis le dossier 'Images'
app.use('/Images', express.static('Images'));

// Vérifier si la colonne orientation existe


// Configurer le stockage des fichiers avec Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Dossier de stockage
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

// Middleware pour servir les fichiers statiques depuis le dossier 'uploads'
app.use('/uploads', express.static('uploads'));

// Route pour gérer l'upload du fichier

// Enregistrez uniquement le nom du fichier de vignette (thumbnail) dans la base de données



// Route pour gérer l'upload du fichier

// Route pour gérer l'upload du fichier
app.post('/upload/vertical', upload.single('videoFile'), (req, res) => {
  try {
      // Le fichier vidéo est stocké dans le dossier 'uploads'
      const videoPath = req.file.path;

      // Enregistrement des informations dans la base de données
      const { videoTitle } = req.body;
      const videoDuration = getVideoDuration(videoPath);

      // Générer une clé unique basée sur la date et l'heure actuelles
      const videoId = 'v_' + uuid.v4(); // Ajoutez "v_" pour indiquer une vidéo verticale

      // Générer une image à partir de la vidéo
      generateThumbnail(videoPath, (thumbnailPath) => {
          // Insérer les informations dans la base de données
          const thumbnailName = path.parse(thumbnailPath).name;
          verticalVideosDB.run('INSERT INTO videos (id, title, path, duration, image, format) VALUES (?, ?, ?, ?, ?, ?)',
              [videoId, videoTitle, videoPath, videoDuration, thumbnailName, 'vertical'], // Assurez-vous de spécifier le format
              function (err) {
                  if (err) {
                      console.error('Erreur lors de l\'insertion dans la base de données:', err);
                      res.status(500).json({ success: false, error: 'Erreur lors de l\'insertion dans la base de données' });
                  } else {
                      res.json({ success: true, imageUrl: `/uploads/${thumbnailName}.png` });
                  }
              });
      });
  } catch (error) {
      console.error('Erreur lors du traitement de la requête /upload:', error);
      res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});


app.post('/upload/horizontal', upload.single('videoFile'), (req, res) => {
  try {
    // Le fichier vidéo est stocké dans le dossier 'uploads'
    const videoPath = req.file.path;

    // Enregistrement des informations dans la base de données
    const { videoTitle } = req.body;
    const videoDuration = getVideoDuration(videoPath);
    const videoOrientation = req.body.videoFormat; // Utilisez le nom approprié du champ

    // Générer une image à partir de la vidéo
    generateThumbnail(videoPath, (thumbnailPath) => {
      // Insérer les informations dans la base de données
      const thumbnailName = path.parse(thumbnailPath).name;
      videosDB.run('INSERT INTO videos (title, path, duration, image, format) VALUES (?, ?, ?, ?, ?)', [videoTitle, videoPath, videoDuration, thumbnailName, videoOrientation], function (err) {
        if (err) {
          console.error('Erreur lors de l\'insertion dans la base de données:', err);
          res.status(500).json({ success: false, error: 'Erreur lors de l\'insertion dans la base de données' });
        } else {
          res.json({ success: true, imageUrl: `/uploads/${thumbnailName}.png` });
        }
      });
    });
  } catch (error) {
    console.error('Erreur lors du traitement de la requête /upload:', error);
    res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});


app.get('/verticalVideos', (req, res) => {
  // Ouvrir la base de données
  const videosDB = new sqlite3.Database('verticalVideos.db');

  // Exécuter la requête SQL pour obtenir les vidéos verticales
  videosDB.all('SELECT * FROM videos', (err, rows) => {
      if (err) {
          res.status(500).json({ success: false, error: err.message });
      } else {
          res.json({ success: true, verticalVideos: rows });
      }

      // Fermer la base de données après avoir terminé la requête
      videosDB.close();
  });
});

app.get('/users', (req, res) => {
  // Ouvrir la base de données
  const usersDB = new sqlite3.Database('users.db');

  // Exécuter la requête SQL pour obtenir les vidéos verticales
  usersDB.all('SELECT * FROM users', (err, rows) => {
      if (err) {
          res.status(500).json({ success: false, error: err.message });
      } else {
          res.json({ success: true, verticalVideos: rows });
      }

      // Fermer la base de données après avoir terminé la requête
      usersDB.close();
  });
});



// Modifier la route /videos dans server.js
app.get('/videos', (req, res) => {
  // Sélectionner toutes les vidéos dans la base de données
  videosDB.all('SELECT * FROM videos', (err, rows) => {
    if (err) {
      console.error('Erreur lors de la récupération des vidéos depuis la base de données:', err);
      res.status(500).json({ success: false, error: 'Erreur lors de la récupération des vidéos depuis la base de données' });
    } else {
      // Renvoyer la liste des vidéos en tant que réponse JSON, y compris le chemin de l'image
      res.json({
        success: true,
        videos: rows.map(video => ({ ...video, imageUrl: `/uploads/${video.image}` })),
      });
    }
  });
});



// Démarrer le serveur
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

// Fonction factice pour obtenir la durée de la vidéo (vous devez implémenter cette logique)
function getVideoDuration(videoPath) {
  // Logique pour obtenir la durée de la vidéo
  // Retourne une valeur factice pour l'instant
  return '00:05:30';
}

function generateThumbnail(videoPath, callback) {
  const thumbnailFileName = `${path.basename(videoPath, path.extname(videoPath))}.png`;
  const thumbnailPath = path.join(__dirname, 'uploads', thumbnailFileName); // Utiliser le dossier 'uploads'

  ffmpeg(videoPath)
    .on('end', () => {
      callback(thumbnailPath);
    })
    .on('error', (err) => {
      console.error('Erreur lors de la génération de la vignette:', err);
      callback(null);
    })
    .screenshots({
      count: 1,
      folder: 'uploads', // Utiliser le dossier 'uploads'
      filename: thumbnailFileName,
    });
}

