package ru.eva.envtest;

/** Registered cells from the offline GLB baker. The same scale is used in every pose. */
final class PersonalPetPose {
    static final int WIDTH=144,HEIGHT=192,COLUMNS=8,ROWS=4;
    static final int IDLE=0,WALK=1,SIT=2,ACTION=3;

    static int row(int mode,int frame,boolean busy,boolean staging,float sitting){
        if(busy)return ACTION;
        if(staging)return sitting>=.5f?SIT:IDLE;
        if(mode==PetMotion.SEATED_PEEK||mode==PetMotion.PERCH_SIT||frame==PetMotion.SIT)return SIT;
        if(PetMotion.gaitFrame(frame)||mode==PetMotion.CROSS||mode==PetMotion.HOME_WALK)return WALK;
        if(mode==PetMotion.LOOK_AROUND||mode==PetMotion.PERCH_LOOK||mode==PetMotion.PERCH_STAND||
           ((mode==PetMotion.ENTER_SIDE||mode==PetMotion.ENTER_BOTTOM)&&frame==PetMotion.IDLE))return IDLE;
        return ACTION;
    }
    static int interval(int row){return row==WALK?105:row==IDLE?210:150;}
    static int column(int row,long elapsed,boolean animated){
        return animated?(int)(Math.max(0,elapsed)/interval(row)%COLUMNS):0;
    }
}
