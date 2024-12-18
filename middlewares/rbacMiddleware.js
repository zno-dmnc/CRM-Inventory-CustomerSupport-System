const authPage = (permissions) => {
    return(req, res, next)=>{
        try{
            const userRole = req.user.user_type
            console.log("USER:" + JSON.stringify(req.user))
            if (permissions.includes(userRole)){
                return next();
            } else{
                return res.status(401).json("Unauthorized Access");
            }
        } catch (error) {
            console.error(`Error occured: ${error.message}`);
            return res.status(400).json({error: "Unauthorized Access"});
        }
    }
}

module.exports = authPage;