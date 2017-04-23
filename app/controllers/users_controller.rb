class UsersController
  def songs
    @songs = Song.where(user_id: params[:user_id])

    render json: @songs
  end
end
