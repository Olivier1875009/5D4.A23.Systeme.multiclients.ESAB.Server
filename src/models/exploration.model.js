import mongoose from 'mongoose';

const explorationSchema = mongoose.Schema({

    explorationDate:{type:String, required:true},
    destination:{type:String, required:true},
    affinity: {type: String, required:true},

    vault: 
    {
        inox: {type: Number, required:true},
        elements:
        [
            {
                name: {type: String, required:true},
                quantity: {type: Number, required:true}
            }
        ]
    }
});

explorationSchema.virtual('ally', {
    ref: 'Ally',
    localField: '_id',
    foreignField: 'exploration',
    justOne: true
});

const Exploration = new mongoose.model('Exploration', explorationSchema);
export { Exploration };