import express from 'express';
import HttpError from 'http-errors';
import { mongoose } from 'mongoose';

import explorerValidators from '../validators/explorer.validator.js'
import ExplorerRepository from "../repositories/explorer.repository.js"
import validator from '../middlewares/validator.js';
import BlacklistedJWTRepository from "../repositories/blacklistedJWT.repository.js";
import { authorizationJWT, refreshJWT } from '../middlewares/authorization.jwt.js';
import explorationRepository from '../repositories/exploration.repository.js';

const router = express.Router();

class ExplorersRoutes {
    constructor() {
        router.get('/:idExplorer', authorizationJWT, this.getOne); // Trouver infos d'un explorateur selon son id
        router.post('/', explorerValidators.complete(), validator, this.post); // Ajout d'un explorateur
        router.post('/actions/login', this.login); // Connexion
        router.get('/actions/logout', authorizationJWT, this.logout); // Déconnexion, blacklist du token
        router.get('/:idExplorer/leaderboards/:order', this.leaderboards); // Retourne les jour classé selon l'ordre demandé (Leaderboard)
        router.get('/actions/refreshToken', authorizationJWT, this.refreshToken); // Retourne les jour classé selon l'ordre demandé (Leaderboard)
      }

    // Route pour la connexion
    async login(req, res, next) {
        
        const { email, username, password } = req.body;

        if((email && username) || email === "" || username === "") {
            return next(HttpError.BadRequest(''));
        }

        const result = await ExplorerRepository.login(email, username, password);

        if(result.explorer) {
            // Nous sommes connectés
            let explorer = result.explorer.toObject({getters:false, virtuals:false});
            explorer = ExplorerRepository.transform(explorer);
            const tokens = ExplorerRepository.generateJWT(explorer.email);
            res.status(200).json({explorer, tokens});
        } else {
            // Erreur lors de la connexion
            return next(result.err);
        }
    }

    // Route pour la connexion
    async getOne(req, res, next) {
        try {
        const idExplorer = req.params.idExplorer;

        let explorer = await ExplorerRepository.retrieveById(idExplorer);

        if (!explorer)
        {
            return next(HttpError.NotFound(`Il n'y a pas d'explorateur avec le username :"${username}"`));
        }
    
        explorer = explorer.toObject({ getters: false, virtuals: true });
        explorer = ExplorerRepository.transform(explorer);

        res.json(explorer).status(200);
        } catch (err)
        {
            return next(err);
        }
    }

    // Déconnexion d'un explorer (Blacklist de son token et redirection vers la page de connexion)
    async logout(req, res, next) {

        try
        {
            // Vérifier ce qui est stocké, supposer avoir stocké Ce qui se trouve après Bearer donc le token
            const tokenToInvalidate = req.headers.authorization.split(' ')[1];
    
            await BlacklistedJWTRepository.create(tokenToInvalidate);
    
            res.status(200).json({ message: 'Déconnecté avec succès!' });
            //res.redirect('/login'); // TODO: !!! Redirection au Login à VALIDER !!!
        } catch(err)
        {
            return next(err);
        }
    }

    // Création d'un explorer
    async post(req, res, next) {
        
        const newExplorer = req.body;

        //Valide s'il y a déjà un user avec ce email ou ce username
        /*let emailSearch = await ExplorerRepository.retrieveByEmail(newExplorer.email);
        let usernameSearch = await ExplorerRepository.retrieveByUsername(newExplorer.username);

        if(emailSearch.length)
        {
            return next(HttpError.Conflict("L'addresse email existe déja dans la base de données."));
        }

        if(usernameSearch.length)
        {
            return next(HttpError.Conflict("Le username existe déjà dans la base de données."));
        }*/

        //Si la requete est vide
        if(Object.keys(newExplorer).length === 0) 
        {//On retourne une erreur BadRequest
            return next(HttpError.BadRequest('Le client ne peut pas contenir aucune donnée'));
        }

        try {
            let explorer = await ExplorerRepository.create(newExplorer);
 
            explorer = explorer.toObject({getters:false, virtuals:false});
            explorer = ExplorerRepository.transform(explorer);
            const tokens = ExplorerRepository.generateJWT(explorer.email);
            res.status(201).json({explorer, tokens});
        } catch(err) {
            return next(err);
        }
    }

    async leaderboards(req, res, next)
    {
        const idExplorer = req.params.idExplorer;
        const order = req.params.order;

        const orderChoices = ["inox", "elements", "allies", "explorations"];

        try
        {
        if(orderChoices.includes(order))
        {
            switch(order)
            {
                case "inox" :
                {
                    //Retourne les 25 premiers selon leur nombre d'inox
                    //+ l'explorateur qui fait la demande
                    let [leaderboards, explorer] = await ExplorerRepository.retrieveOrderedBy(idExplorer, order);
                    
                    //Populate et transforme chacun des explorateurs
                    leaderboards = leaderboards.map(l => 
                        {
                            l = l.toObject({ getters: false, virtuals: false });
                            l = ExplorerRepository.transform(l);
                            return l;
                        });
    
                    //Populate et transforme l'explorateur qui fait la demande
                    explorer = explorer.toObject({getters:false, virtuals:false});
                    explorer = ExplorerRepository.transform(explorer);

                    return res.status(200).json({"top25:" : leaderboards, "you :" : explorer});
                }
                case "elements" :
                {
                    //Retourne les 25 premiers selon leur nombre d'éléments
                    //+ l'explorateur qui fait la demande
                    let [leaderboards, explorer] = await ExplorerRepository.retrieveOrderedBy(idExplorer, order);

                    //Populate et transforme chacun des explorateurs
                    leaderboards = leaderboards.map(l => 
                        {
                            l = l.toObject({ getters: false, virtuals: false });
                            l = ExplorerRepository.transform(l);
                            return l;
                        });
    
                    //Populate et transforme l'explorateur qui fait la demande
                    explorer = explorer.toObject({getters:false, virtuals:false});
                    explorer = ExplorerRepository.transform(explorer);

                    //Order tous le leaderboard par le nombre d'élélments en inventaire
                    //et retourne les 24 premiers
                    leaderboards = await ExplorerRepository.sortBy(leaderboards, order);

                    return res.status(200).json({"top25:" : leaderboards, "you :" : explorer});
                }
                case "allies" :
                {
                    //va chercher les explorateurs
                    //+ l'explorateur qui fait la demande
                    let [leaderboards, explorer] = await ExplorerRepository.retrieveOrderedBy(idExplorer, order);

                    //Populate et transforme chacun des explorateurs
                    leaderboards = leaderboards.map(l => 
                    {
                        l = l.toObject({ getters: true, virtuals: true });
                        l = ExplorerRepository.transform(l);
                        return l;
                    });

                    //Populate et transforme l'explorateur qui fait la demande
                    explorer = explorer.toObject({getters:true, virtuals:true});
                    explorer = ExplorerRepository.transform(explorer);

                    //Order tous le leaderboard par le nombre d'explorations
                    //et retourne les 24 premiers
                    leaderboards = await ExplorerRepository.sortBy(leaderboards, order);
                    
                    return res.status(200).json({"top25:" : leaderboards, "you :" : explorer});
                }
                case "explorations" :
                {
                    //va chercher les explorateurs
                    //+ l'explorateur qui fait la demande
                    let [leaderboards, explorer] = await ExplorerRepository.retrieveOrderedBy(idExplorer, order);

                    //Populate et transforme chacun des explorateurs
                    leaderboards = leaderboards.map(l => 
                    {
                        l = l.toObject({ getters: false, virtuals: true });
                        l = ExplorerRepository.transform(l);
                        return l;
                    });

                    //Populate et transforme l'explorateur qui fait la demande
                    explorer = explorer.toObject({getters:false, virtuals:true});
                    explorer = ExplorerRepository.transform(explorer);

                    //Order tous le leaderboard par le nombre d'explorations
                    //et retourne les 24 premiers
                    leaderboards = await ExplorerRepository.sortBy(leaderboards, order);

                    return res.status(200).json({"top25:" : leaderboards, "you :" : explorer});
                }
            }
        }

        //Erreur, absence d'un ordre de tri ou mauvais ordre de tri
        return res.status(400).json("Mauvais ordre de tri");
        } catch(err)
        {
            return next(err);
        }
    }

    refreshToken(req, res, next)
    {
        try 
        {
            const tokens = ExplorerRepository.generateJWT(req.body.refreshToken.email);
            res.status(201).json(tokens);
        } catch(err) 
        {
            return next(err);
        }
    }
}

new ExplorersRoutes();
export default router;